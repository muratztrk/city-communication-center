import { Building2, Layers3, PenLine, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { api } from '../api/client'
import { invalidateDepartments } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useAuth } from '../context/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Department, DirectoryUserLookup, User } from '../types/platform'
import { userWorksInDepartment } from '../utils/userDepartments'
import { getDepartmentTypeLabel } from '../utils/localization'

type CreateMode = 'manual' | 'ldap'

const EDITABLE_DEPARTMENT_TYPES = ['Birim', 'Administration'] as const

export function DepartmentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('manual')
  const [newName, setNewName] = useState('')
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([])
  const [selectedLdapDepartment, setSelectedLdapDepartment] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editTypeOriginal, setEditTypeOriginal] = useState('')
  const [editManagerUserId, setEditManagerUserId] = useState('')
  const [editResponsibleUserIds, setEditResponsibleUserIds] = useState<string[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [managerAssignId, setManagerAssignId] = useState<string | null>(null)
  const [managerAssignSavingId, setManagerAssignSavingId] = useState<string | null>(null)
  const [pullAllLdapLoading, setPullAllLdapLoading] = useState(false)
  const [addAllLdapLoading, setAddAllLdapLoading] = useState(false)
  const [deleteAllLdapLoading, setDeleteAllLdapLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [deptPageSize, setDeptPageSize] = useState(25)
  const [deptPage, setDeptPage] = useState(1)

  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments.list(),
    queryFn: () => api.getDepartments(),
  })
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => api.getUsers().catch(() => [] as User[]),
  })
  const managementContextQuery = useQuery({
    queryKey: queryKeys.users.managementContext(),
    queryFn: () => api.getUserManagementContext(),
    enabled: user?.role === 'SystemAdmin',
  })
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const managementContext = managementContextQuery.data ?? null
  const ldapEnabled = !!managementContext?.ldapEnabled
  const loading = departmentsQuery.isLoading || usersQuery.isLoading
  const debouncedDirectoryQuery = useDebouncedValue(directoryQuery)
  const shouldSearchDirectory = showForm
    && createMode === 'ldap'
    && ldapEnabled
    && debouncedDirectoryQuery.trim().length >= 2

  useEffect(() => {
    if (!ldapEnabled && createMode === 'ldap') {
      setCreateMode('manual')
    }
  }, [createMode, ldapEnabled])

  useEffect(() => {
    if (!shouldSearchDirectory) {
      return
    }

    let isActive = true

    void api.searchDirectoryUsers(debouncedDirectoryQuery.trim())
      .then(results => {
        if (isActive) {
          setDirectoryResults(results)
        }
      })
      .catch(searchError => {
        if (isActive) {
          setError(searchError instanceof Error ? searchError.message : t('common.error'))
        }
      })

    return () => {
      isActive = false
    }
  }, [debouncedDirectoryQuery, shouldSearchDirectory, t])

  const directoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const result of directoryResults) {
      const name = result.department?.trim()
      if (!name) continue
      const key = name.toLocaleLowerCase('tr')
      if (!map.has(key)) map.set(key, name)
    }
    const query = directoryQuery.trim().toLocaleLowerCase('tr')
    return Array.from(map.values())
      .filter(name => !query || name.toLocaleLowerCase('tr').includes(query))
      .map(name => ({ id: name, label: name }))
  }, [directoryQuery, directoryResults])

  const resetCreateForm = () => {
    setNewName('')
    setDirectoryQuery('')
    setDirectoryResults([])
    setSelectedLdapDepartment(null)
  }

  const switchCreateMode = (mode: CreateMode) => {
    setCreateMode(mode)
    resetCreateForm()
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newName.trim()) {
      return
    }

    if (createMode === 'ldap' && !selectedLdapDepartment) {
      setError(t('departments.directoryDepartmentRequired'))
      return
    }

    try {
      await api.createDepartment({
        name: newName.trim(),
        departmentType: 'Birim',
        managerUserId: null,
        responsibleUserIds: [],
        sourceType: createMode === 'ldap' ? 'Ldap' : 'Manual',
      })
      resetCreateForm()
      setShowForm(false)
      invalidateDepartments(queryClient)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const localeCompareTr = (left: string, right: string) =>
    left.localeCompare(right, 'tr', { sensitivity: 'base' })

  /** Kullanıcı LDAP popup'larındaki iç liste kutusu — birim adları (card #1862). */
  const renderLdapDepartmentList = (title: string, names: string[]) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm text-slate-800 [scrollbar-gutter:stable]">
        {[...names].sort(localeCompareTr).map(name => (
          <li key={name} className="leading-snug font-semibold text-slate-950">{name}</li>
        ))}
      </ul>
    </div>
  )

  const handlePullAllLdapDepartmentsClick = () => {
    if (!ldapEnabled || pullAllLdapLoading) return
    setConfirmDialog({
      title: t('departments.liveLdapSync'),
      titleDivider: true,
      titleCompact: true,
      message: t('departments.liveLdapSyncConfirm', 'LDAP dizininden birim listesi çekilecek. Devam etmek istiyor musunuz?'),
      confirmLabel: t('common.yes', 'Evet'),
      variant: 'primary',
      closeOnConfirm: false,
      onConfirm: () => handlePullAllLdapDepartments(),
    })
  }

  const handlePullAllLdapDepartments = async () => {
    setPullAllLdapLoading(true)
    setError('')
    setConfirmDialog(current => current
      ? {
          ...current,
          message: t('departments.liveLdapSyncWorking'),
          confirmLabel: t('common.yes', 'Evet'),
          hideCancel: true,
          closeOnConfirm: false,
          details: undefined,
          onConfirm: () => {},
        }
      : current)

    try {
      // physicalDeliveryOfficeName listesi — OU yok (card #1838).
      const departmentNames = await api.listDirectoryDepartments()
      const foundNamesByKey = new Map<string, string>()
      const listedResults: DirectoryUserLookup[] = []

      for (const rawName of departmentNames) {
        const name = rawName.trim()
        if (!name) continue
        const key = name.toLocaleLowerCase('tr')
        if (foundNamesByKey.has(key)) continue
        foundNamesByKey.set(key, name)
        listedResults.push({
          externalIdentityId: `ldap-unit:${key}`,
          username: name,
          displayName: name,
          email: null,
          department: name,
          alreadyLinked: false,
          existingUserId: null,
          title: null,
          phone: null,
        })
      }

      const listedNames = [...foundNamesByKey.values()]
      setDirectoryResults(listedResults)
      setDirectoryQuery('')
      setSelectedLdapDepartment(null)
      setNewName('')
      setConfirmDialog({
        title: t('departments.liveLdapSync'),
        titleDivider: true,
        titleCompact: true,
        titleTone: 'success',
        message: t('departments.pullAllLdapSuccess', { count: listedNames.length }),
        details: listedNames.length > 0
          ? renderLdapDepartmentList(
              t('departments.pullAllLdapListedTitle', { count: listedNames.length }),
              listedNames,
            )
          : undefined,
        confirmLabel: t('common.exit', 'Çıkış'),
        hideCancel: true,
        variant: 'primary',
        onConfirm: () => {},
      })
    } catch (pullError) {
      setConfirmDialog(null)
      setError(pullError instanceof Error ? pullError.message : t('common.error'))
    } finally {
      setPullAllLdapLoading(false)
    }
  }

  const handleAddAllLdapDepartmentsClick = async () => {
    if (!ldapEnabled || addAllLdapLoading) return

    setAddAllLdapLoading(true)
    setError('')
    try {
      const departmentNames = await api.listDirectoryDepartments()
      const existingKeys = new Set(departments.map(item => item.name.trim().toLocaleLowerCase('tr')))
      const toAdd: string[] = []
      const seen = new Set<string>()

      for (const rawName of departmentNames) {
        const name = rawName.trim()
        if (!name) continue
        const key = name.toLocaleLowerCase('tr')
        if (seen.has(key) || existingKeys.has(key)) continue
        seen.add(key)
        toAdd.push(name)
      }

      if (toAdd.length === 0) {
        setConfirmDialog({
          title: t('departments.addAllLdap'),
          titleDivider: true,
          titleCompact: true,
          titleTone: 'danger',
          message: t('departments.addAllLdapNone'),
          confirmLabel: t('common.exit', 'Çıkış'),
          hideCancel: true,
          variant: 'destructive',
          onConfirm: () => {},
        })
        return
      }

      const runBulkAdd = async () => {
        setAddAllLdapLoading(true)
        setError('')
        setConfirmDialog(current => current
          ? {
              ...current,
              message: t('departments.addAllLdapWorking'),
              hideCancel: true,
              closeOnConfirm: false,
              details: undefined,
              onConfirm: () => {},
            }
          : current)
        try {
          const createdNames: string[] = []
          for (const name of toAdd) {
            await api.createDepartment({
              name,
              departmentType: 'Birim',
              managerUserId: null,
              responsibleUserIds: [],
              sourceType: 'Ldap',
            })
            createdNames.push(name)
          }
          invalidateDepartments(queryClient)
          setConfirmDialog({
            title: t('departments.addAllLdap'),
            titleDivider: true,
            titleCompact: true,
            titleTone: 'success',
            message: t('departments.addAllLdapSuccess', { count: createdNames.length }),
            details: renderLdapDepartmentList(
              t('departments.addAllLdapAddedTitle', { count: createdNames.length }),
              createdNames,
            ),
            confirmLabel: t('common.exit', 'Çıkış'),
            hideCancel: true,
            variant: 'primary',
            onConfirm: () => {},
          })
        } catch (createError) {
          setConfirmDialog(null)
          setError(createError instanceof Error ? createError.message : t('common.error'))
        } finally {
          setAddAllLdapLoading(false)
        }
      }

      // Kullanıcı LDAP ekle gibi: onay popup'ında eklenecek liste (card #1862).
      setConfirmDialog({
        title: t('departments.addAllLdap'),
        titleDivider: true,
        titleCompact: true,
        message: t('departments.addAllLdapConfirm', { count: toAdd.length }),
        details: renderLdapDepartmentList(
          t('departments.addAllLdapWillAddTitle', { count: toAdd.length }),
          toAdd,
        ),
        confirmLabel: t('common.add', 'Ekle'),
        cancelLabel: t('common.exit', 'Çıkış'),
        cancelVariant: 'destructive',
        variant: 'primary',
        closeOnConfirm: false,
        onConfirm: () => void runBulkAdd(),
      })
    } catch (listError) {
      setConfirmDialog(null)
      setError(listError instanceof Error ? listError.message : t('common.error'))
    } finally {
      setAddAllLdapLoading(false)
    }
  }

  const handleDeleteAllLdapDepartmentsClick = () => {
    if (!ldapEnabled || deleteAllLdapLoading) {
      return
    }

    setConfirmDialog({
      title: t('departments.deleteAllLdap'),
      titleDivider: true,
      titleCompact: true,
      titleTone: 'danger',
      message: t('departments.deleteAllLdapConfirm'),
      confirmLabel: t('common.delete', 'Sil'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'destructive',
      closeOnConfirm: false,
      onConfirm: () => runDeleteAllLdapDepartments(),
    })
  }

  const runDeleteAllLdapDepartments = async () => {
    setDeleteAllLdapLoading(true)
    setError('')
    setConfirmDialog(current => current
      ? {
          ...current,
          message: t('departments.deleteAllLdapWorking'),
          hideCancel: true,
          closeOnConfirm: false,
          onConfirm: () => {},
        }
      : current)
    try {
      const result = await api.deleteUnusedLdapDepartments()
      invalidateDepartments(queryClient)
      setConfirmDialog({
        title: t('departments.deleteAllLdap'),
        titleDivider: true,
        titleCompact: true,
        titleTone: result.deletedCount > 0 ? 'success' : 'danger',
        message: result.deletedCount > 0
          ? t('departments.deleteAllLdapSuccess', { count: result.deletedCount })
          : t('departments.deleteAllLdapNone'),
        confirmLabel: t('common.exit', 'Çıkış'),
        hideCancel: true,
        variant: 'destructive',
        onConfirm: () => {},
      })
    } catch (deleteError) {
      setConfirmDialog(null)
      setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
    } finally {
      setDeleteAllLdapLoading(false)
    }
  }

  const startEdit = (department: Department) => {
    setEditId(department.departmentId)
    setEditName(department.name)
    setEditTypeOriginal(department.departmentType)
    // Tür default Birim; Yönetim ise koru (card #1720).
    setEditType(department.departmentType === 'Administration' ? 'Administration' : 'Birim')
    setEditManagerUserId(department.managerUserId ?? '')
    setEditResponsibleUserIds(department.responsibleUserIds ?? [])
    setDeleteConfirmId(null)
    setManagerAssignId(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditType('')
    setEditTypeOriginal('')
    setEditManagerUserId('')
    setEditResponsibleUserIds([])
  }

  const editTypeOptions = useMemo(() => {
    const base = [...EDITABLE_DEPARTMENT_TYPES]
    if (editTypeOriginal && !(EDITABLE_DEPARTMENT_TYPES as readonly string[]).includes(editTypeOriginal)) {
      return [editTypeOriginal, ...base]
    }
    return base
  }, [editTypeOriginal])

  const handleUpdate = async (departmentId: string) => {
    if (!editName.trim()) {
      return
    }

    try {
      await api.updateDepartment(departmentId, {
        name: editName.trim(),
        departmentType: editType || editTypeOriginal || 'Birim',
        managerUserId: editManagerUserId || null,
        responsibleUserIds: editResponsibleUserIds,
      })
      cancelEdit()
      invalidateDepartments(queryClient)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleDelete = async (departmentId: string) => {
    try {
      await api.deleteDepartment(departmentId)
      setDeleteConfirmId(null)
      invalidateDepartments(queryClient)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
  }

  const assignDepartmentManager = async (department: Department, managerUserId: string | null) => {
    setManagerAssignSavingId(department.departmentId)
    setError('')

    try {
      const updated = await api.updateDepartment(department.departmentId, {
        name: department.name,
        departmentType: department.departmentType,
        managerUserId,
        responsibleUserIds: department.responsibleUserIds ?? [],
      })
      queryClient.setQueryData<Department[]>(
        queryKeys.departments.list(),
        current => current?.map(item => item.departmentId === updated.departmentId ? updated : item) ?? [updated],
      )
      invalidateDepartments(queryClient)
      setManagerAssignId(null)
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : t('common.error'))
    } finally {
      setManagerAssignSavingId(null)
    }
  }

  const typeSummary = useMemo(() => {
    return departments.reduce<Record<string, number>>((summary, department) => {
      summary[department.departmentType] = (summary[department.departmentType] ?? 0) + 1
      return summary
    }, {})
  }, [departments])

  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'
  const getManagerCandidates = () => users.filter(item => item.isActive)
  const userBelongsToDepartment = (item: User, departmentId?: string) => {
    if (!departmentId) return true
    return userWorksInDepartment(item, departmentId)
  }
  const getDepartmentUsers = (departmentId?: string) => users.filter(item => item.isActive && userBelongsToDepartment(item, departmentId))
  const getUserOptions = (sourceUsers: User[]) => sourceUsers.map(item => ({ value: item.userId, label: item.displayName }))
  const canEditDepartment = (department: Department) => user?.role === 'SystemAdmin' || department.managerUserId === user?.userId

  const { sortKey: deptSortKey, sortDir: deptSortDir, toggleSort: toggleDeptSort, sortItems: sortDepts } = useSortable()
  const { filters: deptFilters, setFilter: setDeptFilter, matchesFilters: deptMatchesFilters } = useColumnFilters()

  const departmentRows = useMemo(
    () => departments.map(department => ({
      ...department,
      managerName: users.find(item => item.userId === department.managerUserId)?.displayName ?? '—',
    })),
    [departments, users],
  )
  const sortedDepts = useMemo(() => {
    if (deptSortKey) return sortDepts(departmentRows)
    // Varsayılan: birim adı alfabetik (TR) (card #1856).
    return [...departmentRows].sort((a, b) =>
      a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }))
  }, [departmentRows, deptSortKey, sortDepts])
  const columnFilteredDepts = useMemo(
    () => sortedDepts.filter(d => deptMatchesFilters(d)),
    [sortedDepts, deptMatchesFilters],
  )

  const handleDeptFilter = (key: string, value: string) => {
    setDeptFilter(key, value)
    setDeptPage(1)
  }

  const handleDeptSort = (key: string) => {
    toggleDeptSort(key)
    setDeptPage(1)
  }

  const handleDeptPageSizeChange = (size: number) => {
    setDeptPageSize(size)
    setDeptPage(1)
  }

  const deptTotalCount = columnFilteredDepts.length
  const deptTotalPages = Math.max(1, Math.ceil(deptTotalCount / deptPageSize) || 1)
  const deptSafePage = Math.min(deptPage, deptTotalPages)
  const pagedDepts = useMemo(() => {
    const start = (deptSafePage - 1) * deptPageSize
    return columnFilteredDepts.slice(start, start + deptPageSize)
  }, [deptSafePage, deptPageSize, columnFilteredDepts])
  const editingDepartment = departments.find(department => department.departmentId === editId) ?? null
  const isEditingLdapDepartment = editingDepartment?.sourceType === 'Ldap'

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className={`page-stack desktop-page-shell admin-surface-page${showForm ? ' shrink-0' : ''}`}>
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('departments.title')}</h1>
            <p className="page-subtitle">{t('departments.subtitle')}</p>
          </div>
          <Button
            type="button"
            variant={showForm ? 'destructive' : 'primary'}
            onClick={() => {
              setShowForm(current => {
                const next = !current
                if (!next) {
                  resetCreateForm()
                  setCreateMode(ldapEnabled && managementContext?.localUsersEnabled === false ? 'ldap' : 'manual')
                }
                return next
              })
            }}
          >
            {showForm ? t('common.cancel') : t('departments.new')}
          </Button>
        </div>
      </header>

      <section className="metric-grid">
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
              <Building2 className="size-4.5" />
            </div>
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('departments.total')}</div>
              <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{departments.length}</div>
            </div>
          </div>
        </div>
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-accent)]/18 text-[color:var(--color-primary)]">
              <Layers3 className="size-4.5" />
            </div>
            <div className="space-y-1">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('departments.typeBreakdown')}</div>
              <div className="inline-actions">
                {Object.entries(typeSummary).map(([type, count]) => (
                  <StatusPill key={type}>{getDepartmentTypeLabel(t, type)}: {count}</StatusPill>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {showForm ? (
        <form className="form-card page-stack shrink-0" onSubmit={handleCreate}>
          <div className="page-header-row">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{t('departments.newFormTitle')}</h2>
              <p className="helper-copy">{t('departments.newFormDescription')}</p>
            </div>
          </div>

          {ldapEnabled ? (
            <div className="grid gap-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('departments.createMode')}</span>
                <div className="segmented-control">
                  {managementContext?.localUsersEnabled !== false ? (
                    <button className={createMode === 'manual' ? 'active' : ''} onClick={() => switchCreateMode('manual')} type="button">
                      {t('departments.manualMode')}
                    </button>
                  ) : null}
                  <button className={createMode === 'ldap' ? 'active' : ''} onClick={() => switchCreateMode('ldap')} type="button">
                    {t('departments.ldapMode')}
                  </button>
                </div>
              </label>
              <p className="helper-copy">
                {createMode === 'ldap' ? t('departments.sourceLdapHint') : t('departments.sourceManualHint')}
              </p>
              {createMode === 'ldap' ? (
                <p className="helper-copy text-red-600/90">{t('departments.deleteAllLdapHint')}</p>
              ) : null}
            </div>
          ) : null}

          {createMode === 'ldap' && ldapEnabled ? (
            <div className="section-card page-stack">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="ldap-section-title text-lg font-extrabold text-slate-950">{t('departments.directorySearch')}</h3>
                <button
                  type="button"
                  className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                  disabled={pullAllLdapLoading}
                  onClick={() => handlePullAllLdapDepartmentsClick()}
                >
                  {pullAllLdapLoading ? t('departments.liveLdapSyncWorking') : t('departments.liveLdapSync')}
                </button>
                <button
                  type="button"
                  className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                  disabled={addAllLdapLoading || pullAllLdapLoading}
                  onClick={() => handleAddAllLdapDepartmentsClick()}
                >
                  {addAllLdapLoading ? t('departments.addAllLdapWorking') : t('departments.addAllLdap')}
                </button>
                <button
                  type="button"
                  className="text-sm font-bold text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
                  disabled={addAllLdapLoading || pullAllLdapLoading || deleteAllLdapLoading}
                  onClick={handleDeleteAllLdapDepartmentsClick}
                >
                  {deleteAllLdapLoading ? t('departments.deleteAllLdapWorking') : t('departments.deleteAllLdap')}
                </button>
              </div>
              <p className="helper-copy">{t('departments.directorySearchDescription')}</p>
              <AutocompleteField
                ariaLabel={t('departments.directorySearchAria')}
                emptyMessage={t('departments.directorySearchEmpty')}
                loadingMessage={t('departments.directorySearchLoading')}
                options={directoryOptions}
                placeholder={t('departments.directorySearchPlaceholder')}
                value={directoryQuery}
                onOptionSelect={option => {
                  setSelectedLdapDepartment(option.label)
                  setDirectoryQuery(option.label)
                  setNewName(option.label)
                }}
                onValueChange={value => {
                  setDirectoryQuery(value)
                  if (value.trim().length < 2) {
                    setDirectoryResults([])
                  }
                  if (!value.trim()) {
                    setSelectedLdapDepartment(null)
                    setNewName('')
                  }
                }}
              />
              {selectedLdapDepartment ? (
                <div className="section-card">
                  <div className="font-semibold text-slate-950">{selectedLdapDepartment}</div>
                  <p className="helper-copy mt-1">{t('departments.directoryDepartmentSelected')}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {createMode === 'manual' || !ldapEnabled ? (
            <label className="grid gap-2 text-sm font-semibold text-slate-700 max-w-md">
              <span>{t('departments.name')}</span>
              <input
                className="field-input"
                placeholder={t('departments.namePlaceholder')}
                type="text"
                value={newName}
                onChange={event => setNewName(event.target.value)}
              />
            </label>
          ) : null}
          <div className="inline-actions">
            <Button
              type="submit"
              disabled={createMode === 'ldap' && (!selectedLdapDepartment || !newName.trim())}
            >
              {t('common.create')}
            </Button>
          </div>
        </form>
      ) : null}

      <section className={`section-card${showForm ? '' : ' desktop-page-fill'}`}>
        <div className={`table-wrap${showForm ? '' : ' desktop-panel-scroll'}`}>
          <table className="data-table departments-table">
            <thead>
              <tr>
                <FilterableTh
                  filterKey="name"
                  filterValue={deptFilters['name'] ?? ''}
                  onFilter={handleDeptFilter}
                  sortKey="name"
                  currentSortKey={deptSortKey}
                  sortDir={deptSortDir}
                  onSort={handleDeptSort}
                >
                  {t('departments.name')}
                </FilterableTh>
                <FilterableTh
                  filterKey="managerName"
                  filterValue={deptFilters['managerName'] ?? ''}
                  onFilter={handleDeptFilter}
                  sortKey="managerName"
                  currentSortKey={deptSortKey}
                  sortDir={deptSortDir}
                  onSort={handleDeptSort}
                >
                  {t('departments.manager', 'Müdür')}
                </FilterableTh>
                <th>{t('departments.responsibles', 'Sorumlular')}</th>
                <th className="w-64 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedDepts.map(department => {
                const isManagerAssigning = managerAssignId === department.departmentId
                const isManagerSaving = managerAssignSavingId === department.departmentId

                return (
                  <tr key={department.departmentId}>
                    <td className="font-semibold">{department.name}</td>
                    <td>
                      {isManagerAssigning ? (
                        <SingleSelectDropdown
                          options={[
                            { value: '', label: t('departments.noManager', '— Müdür Yok —') },
                            ...getManagerCandidates().map(item => ({
                              value: item.userId,
                              label: item.displayName,
                            })),
                          ]}
                          value={department.managerUserId ?? ''}
                          onChange={value => void assignDepartmentManager(department, value || null)}
                          placeholder={t('departments.assignManager', 'Yönetici Ata')}
                          disabled={isManagerSaving}
                          searchable
                          searchPlaceholder={t('common.search', 'Ara...')}
                          className="min-w-52"
                        />
                      ) : (
                        getUserName(department.managerUserId)
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(department.responsibleUserIds ?? []).length > 0
                          ? department.responsibleUserIds.map(responsibleUserId => (
                              <StatusPill key={responsibleUserId} tone="info">{getUserName(responsibleUserId)}</StatusPill>
                            ))
                          : '—'}
                      </div>
                    </td>
                    <td className="actions-column text-center">
                        {deleteConfirmId === department.departmentId ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-red-600">{t('departments.deleteConfirm', { name: department.name })}</span>
                            <div className="inline-actions justify-center">
                              <Button size="sm" variant="destructive" onClick={() => void handleDelete(department.departmentId)}>
                                {t('common.delete')}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="row-actions justify-center">
                            {canEditDepartment(department) ? (
                              <>
                                {isManagerAssigning ? (
                                  <Button size="sm" variant="secondary" onClick={() => setManagerAssignId(null)} disabled={isManagerSaving}>
                                    {t('common.cancel')}
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="secondary" onClick={() => { setManagerAssignId(department.departmentId); setEditId(null); setDeleteConfirmId(null) }}>
                                    {t('departments.assignManager', 'Yönetici Ata')}
                                  </Button>
                                )}
                                <button className="icon-action icon-action--labeled" title={t('common.edit')} aria-label={t('common.edit')} type="button" onClick={() => startEdit(department)}>
                                  <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                                  <span>{t('common.edit')}</span>
                                </button>
                              </>
                            ) : null}
                            <button className="icon-action icon-action--labeled danger" title={t('common.delete')} aria-label={t('common.delete')} type="button" onClick={() => { setDeleteConfirmId(department.departmentId); setEditId(null); setManagerAssignId(null) }}>
                              <Trash2 className="size-3.5" />
                              <span>{t('common.delete')}</span>
                            </button>
                          </div>
                        )}
                    </td>
                  </tr>
                )
              })}
              {pagedDepts.length === 0 ? (
                <TableEmptyStateRows columnCount={4} message={t('departments.empty')} />
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={deptTotalCount}
          pageSize={deptPageSize}
          currentPage={deptSafePage}
          onPageSizeChange={handleDeptPageSizeChange}
          onPageChange={setDeptPage}
        />
      </section>

      {editId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form className="w-full max-w-2xl rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl" onSubmit={event => { event.preventDefault(); void handleUpdate(editId) }} onClick={event => event.stopPropagation()}>
            <div className="page-header-row mb-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('departments.editFormTitle')}</h2>
                <p className="helper-copy">{t('departments.newFormDescription')}</p>
              </div>
              <button className="icon-btn text-slate-400" title={t('common.cancel')} type="button" onClick={cancelEdit}>
                <X className="size-4" />
              </button>
            </div>
            {isEditingLdapDepartment ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {t('departments.ldapReadOnly')}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={cancelEdit}>{t('common.close', 'Kapat')}</Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('departments.name')}</span>
                    <input className="field-input" type="text" value={editName} onChange={event => setEditName(event.target.value)} />
                  </label>
                  {/* label yerine div: label tıklaması dropdown'ı yeniden açıyordu (card #1729). */}
                  <div className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('departments.type')}</span>
                    <SingleSelectDropdown
                      options={editTypeOptions.map(type => ({
                        value: type,
                        label: getDepartmentTypeLabel(t, type),
                      }))}
                      value={editType}
                      onChange={setEditType}
                      placeholder={t('departments.type')}
                    />
                  </div>
                  <div className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                    <span>{editType === 'Administration' ? t('departments.administrator') : t('departments.manager', 'Müdür')}</span>
                    <SingleSelectDropdown
                      options={[
                        { value: '', label: t('common.optional', '— Seçin (opsiyonel)') },
                        ...getManagerCandidates().map(item => ({
                          value: item.userId,
                          label: item.displayName,
                        })),
                      ]}
                      value={editManagerUserId}
                      onChange={setEditManagerUserId}
                      placeholder={t('common.optional', '— Seçin (opsiyonel)')}
                      searchable
                      searchPlaceholder={t('common.search', 'Ara...')}
                    />
                  </div>
                  <div className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                    <span>{t('departments.responsibles', 'Sorumlular')}</span>
                    <MultiSelectDropdown
                      options={getUserOptions(getDepartmentUsers(editId))}
                      value={editResponsibleUserIds}
                      onChange={setEditResponsibleUserIds}
                      placeholder={t('departments.responsiblesPlaceholder', 'Sorumlu kullanıcı seçin')}
                      emptyText={t('departments.responsiblesEmpty', 'Aktif kullanıcı bulunmuyor.')}
                      searchable
                      searchPlaceholder={t('common.search', 'Ara...')}
                    />
                    <span className="helper-copy">{t('departments.responsiblesHelp', 'Birden fazla kullanıcı seçebilirsiniz.')}</span>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={cancelEdit}>{t('common.cancel')}</Button>
                  <Button type="submit">{t('common.save')}</Button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}

      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
