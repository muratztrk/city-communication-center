import type { FormEvent } from 'react'
import { ShieldUser, PenLine, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateUsers } from '../api/cacheInvalidation'
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
import type { Department, DirectoryUserLookup, User, UserManagementContext } from '../types/platform'
import { getRoleLabel, getUserSourceLabel } from '../utils/localization'
import { ROLE_CODES } from '../lib/rolePageAccess'

type CreateMode = 'manual' | 'ldap'

const PRIMARY_ROLE_CODES = [...ROLE_CODES]
const ADDITIONAL_ROLE_CODES = ['Operator', 'Staff', 'Reporter', 'EDevletActivityPlan', 'CitizenRequestManager'] as const

const DEFAULT_USER_FORM = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  departmentId: '',
  additionalDepartmentIds: [] as string[],
  roleCode: 'Staff',
  additionalRoleCodes: [] as string[],
  isActive: true,
  externalIdentityId: null as string | null,
}

function readCreateMode(value: string | null, capabilities: UserManagementContext | null): CreateMode {
  if (value === 'ldap' && capabilities?.ldapEnabled) {
    return 'ldap'
  }

  if (capabilities && !capabilities.localUsersEnabled && capabilities.ldapEnabled) {
    return 'ldap'
  }

  return 'manual'
}

function resolveDataRequests(canManageUsers: boolean) {
  return Promise.all([
    api.getUsers(),
    api.getDepartments(),
    canManageUsers ? api.getUserManagementContext() : Promise.resolve<UserManagementContext | null>(null),
  ] as const)
}

export function UsersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managementContext, setManagementContext] = useState<UserManagementContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState(DEFAULT_USER_FORM)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    displayName: '',
    title: '',
    email: '',
    departmentId: '',
    additionalDepartmentIds: [] as string[],
    roleCode: '',
    additionalRoleCodes: [] as string[],
    isActive: true,
  })
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([])
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserLookup | null>(null)
  const [directorySyncLoading, setDirectorySyncLoading] = useState(false)
  const [directorySyncMessage, setDirectorySyncMessage] = useState<string | null>(null)
  const [addAllLdapLoading, setAddAllLdapLoading] = useState(false)
  /** LDAP'ta birim alanı boş kullanıcılar — buton sağındaki dropdown (card #1752). */
  const [ldapUsersWithoutDepartment, setLdapUsersWithoutDepartment] = useState<DirectoryUserLookup[]>([])
  const [ldapUsersWithoutDepartmentValue, setLdapUsersWithoutDepartmentValue] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const canManageUsers = currentUser?.role === 'SystemAdmin'
  const showForm = searchParams.get('create') === '1'
  const createMode = readCreateMode(searchParams.get('mode'), managementContext)
  const debouncedDirectoryQuery = useDebouncedValue(directoryQuery)
  const shouldSearchDirectory = showForm
    && createMode === 'ldap'
    && !!managementContext?.ldapEnabled
    && debouncedDirectoryQuery.trim().length >= 2

  const getDepartmentManager = (departmentId: string, excludeUserId?: string): User | undefined => {
    if (!departmentId) return undefined
    return users.find(u => u.departmentId === departmentId && u.roleCode === 'Manager' && u.userId !== excludeUserId)
  }

  const getUserDepartmentIds = (item: User): string[] => {
    const ids = new Set<string>([item.departmentId])
    item.departments?.forEach(department => ids.add(department.departmentId))
    return Array.from(ids)
  }

  const loadData = () => {
    setLoading(true)
    setError('')

    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        setUsers(loadedUsers)
        setDepartments(loadedDepartments)
        setManagementContext(capabilities)
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let isActive = true

    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        if (!isActive) {
          return
        }

        setUsers(loadedUsers)
        setDepartments(loadedDepartments)
        setManagementContext(capabilities)
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [canManageUsers, t])

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

  const localeCompareTr = (left: string, right: string) =>
    left.localeCompare(right, 'tr', { sensitivity: 'base' })

  const sortByOu = (items: DirectoryUserLookup[]) =>
    [...items].sort((left, right) =>
      localeCompareTr(
        (left.organizationalUnit || left.department || left.displayName || '').trim(),
        (right.organizationalUnit || right.department || right.displayName || '').trim(),
      ))

  const sortByDepartmentOrName = (items: DirectoryUserLookup[]) =>
    [...items].sort((left, right) =>
      localeCompareTr(
        (left.department || left.displayName || '').trim(),
        (right.department || right.displayName || '').trim(),
      ))

  type LdapListMetaMode = 'department' | 'ou' | 'none'

  const renderLdapUserList = (title: string, items: DirectoryUserLookup[], metaMode: LdapListMetaMode) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm text-slate-800 [scrollbar-gutter:stable]">
        {items.map(item => (
          <li key={item.externalIdentityId} className="leading-snug">
            <span className="font-semibold text-slate-950">{item.displayName || item.username}</span>
            {metaMode === 'ou' ? (
              <span className="text-slate-500">
                {' — '}
                {item.organizationalUnit?.trim()
                  ? t('users.addAllLdapMissingOu', { ou: item.organizationalUnit.trim() })
                  : t('users.addAllLdapNoOu')}
              </span>
            ) : null}
            {metaMode === 'department' ? (
              <span className="text-slate-500">
                {' — '}
                {item.department?.trim()
                  ? t('users.addAllLdapMissingDepartment', { department: item.department.trim() })
                  : t('users.addAllLdapNoDepartment')}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )

  const renderLdapUserLists = (...sections: Array<{ title: string; items: DirectoryUserLookup[]; metaMode: LdapListMetaMode } | null>) => {
    const visible = sections.filter((section): section is { title: string; items: DirectoryUserLookup[]; metaMode: LdapListMetaMode } =>
      !!section && section.items.length > 0)
    if (visible.length === 0) {
      return undefined
    }
    return (
      <div className="space-y-3">
        {visible.map(section => (
          <div key={section.title}>
            {renderLdapUserList(section.title, section.items, section.metaMode)}
          </div>
        ))}
      </div>
    )
  }

  const handleLiveLdapUserSync = async () => {
    if (!managementContext?.ldapEnabled) {
      return
    }

    const query = directoryQuery.trim()
    if (query.length < 2) {
      setDirectorySyncMessage(t('users.liveLdapSyncNeedQuery'))
      return
    }

    setDirectorySyncLoading(true)
    setDirectorySyncMessage(t('users.liveLdapSyncWorking'))
    setError('')

    try {
      // Yalnız aktif LDAP; otomatik create yok — popup ile liste (card #1754).
      const results = await api.searchDirectoryUsers(query)
      setDirectoryResults(results)
      setDirectorySyncMessage(null)
      setConfirmDialog({
        title: t('users.liveLdapSync'),
        titleDivider: true,
        titleCompact: true,
        titleTone: 'success',
        message: t('users.liveLdapSyncDone'),
        details: results.length > 0
          ? renderLdapUserList(
              t('users.addAllLdapNewlyPulledTitle', { count: results.length }),
              sortByDepartmentOrName(results),
              'department',
            )
          : undefined,
        confirmLabel: t('common.exit', 'Çıkış'),
        hideCancel: true,
        variant: 'destructive',
        onConfirm: () => {},
      })
    } catch (syncError) {
      setDirectorySyncMessage(null)
      setError(syncError instanceof Error ? syncError.message : t('common.error'))
    } finally {
      setDirectorySyncLoading(false)
    }
  }

  const handleAddAllLdapUsersClick = async () => {
    if (!managementContext?.ldapEnabled || addAllLdapLoading) {
      return
    }

    setAddAllLdapLoading(true)
    setError('')
    setDirectorySyncMessage(null)

    try {
      // Yalnızca aktif LDAP kullanıcıları (BE filter); ekleme ConfirmDialog Ekle ile (cards #1750/#1757).
      const results = await api.listDirectoryUsers()
      const withoutLdapDepartment = results.filter(item => !item.department?.trim())
      setLdapUsersWithoutDepartment(withoutLdapDepartment)
      setLdapUsersWithoutDepartmentValue('')

      // alreadyLinked: externalId veya sAMAccountName (card #1758).
      const candidates = results.filter(item => !item.alreadyLinked)
      const departmentByKey = new Map(
        departments.map(item => [item.name.trim().toLocaleLowerCase('tr'), item.departmentId] as const),
      )

      // PDO/department dolu → eklenebilir (sistemde yoksa ldapDepartmentName — card #1763).
      // PDO boş → birimi eksik; listede OU (cards #1764/#1765).
      const addable = sortByDepartmentOrName(candidates.filter(item => !!item.department?.trim()))
      const missingDeptUsers = sortByOu(candidates.filter(item => !item.department?.trim()))

      if (candidates.length === 0) {
        setDirectorySyncMessage(t('users.addAllLdapNone'))
        return
      }

      const runBulkAdd = async () => {
        setAddAllLdapLoading(true)
        setError('')
        const createdUsers: DirectoryUserLookup[] = []
        try {
          for (const item of addable) {
            const deptName = item.department!.trim()
            const departmentId = departmentByKey.get(deptName.toLocaleLowerCase('tr')) ?? null

            await api.createUser({
              username: item.username || null,
              displayName: item.displayName,
              email: item.email?.trim() || null,
              password: null,
              departmentId: departmentId ?? '00000000-0000-0000-0000-000000000000',
              additionalDepartmentIds: [],
              roleCode: 'Staff',
              additionalRoleCodes: [],
              isActive: true,
              sourceType: 'Ldap',
              externalIdentityId: item.externalIdentityId,
              ldapDepartmentName: departmentId ? null : deptName,
            })
            createdUsers.push(item)
          }

          setDirectorySyncMessage(
            missingDeptUsers.length === 0
              ? t('users.addAllLdapAllSuccess')
              : t('users.addAllLdapSuccess', { count: createdUsers.length }),
          )
          invalidateUsers(queryClient)
          loadData()

          setConfirmDialog({
            title: t('users.addAllLdap'),
            titleDivider: true,
            titleCompact: true,
            titleTone: 'success',
            message:
              missingDeptUsers.length === 0
                ? t('users.addAllLdapAllSuccess')
                : t('users.addAllLdapSuccess', { count: createdUsers.length }),
            details: createdUsers.length > 0
              ? renderLdapUserList(
                  t('users.addAllLdapNewlyPulledTitle', { count: createdUsers.length }),
                  sortByDepartmentOrName(createdUsers),
                  'none',
                )
              : undefined,
            confirmLabel: t('common.exit', 'Çıkış'),
            hideCancel: true,
            variant: 'destructive',
            onConfirm: () => {},
          })
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : t('common.error'))
        } finally {
          setAddAllLdapLoading(false)
        }
      }

      if (addable.length === 0) {
        setConfirmDialog({
          title: t('users.addAllLdap'),
          titleDivider: true,
          titleCompact: true,
          titleTone: 'danger',
          message: t('users.addAllLdapDepartmentsRequired'),
          details: renderLdapUserLists({
            title: t('users.addAllLdapMissingUsersTitle', { count: missingDeptUsers.length }),
            items: missingDeptUsers,
            metaMode: 'ou',
          }),
          confirmLabel: t('common.exit', 'Çıkış'),
          hideCancel: true,
          variant: 'destructive',
          onConfirm: () => {},
        })
        return
      }

      setConfirmDialog({
        title: t('users.addAllLdap'),
        titleDivider: true,
        titleCompact: true,
        titleTone: missingDeptUsers.length > 0 ? 'danger' : undefined,
        message:
          missingDeptUsers.length > 0
            ? t('users.addAllLdapDepartmentsRequired')
            : t('users.addAllLdapConfirm', { count: addable.length }),
        details: missingDeptUsers.length > 0
          ? renderLdapUserLists(
              {
                title: t('users.addAllLdapMissingUsersTitle', { count: missingDeptUsers.length }),
                items: missingDeptUsers,
                metaMode: 'ou',
              },
              {
                title: t('users.addAllLdapWillAddTitle', { count: addable.length }),
                items: addable,
                metaMode: 'department',
              },
            )
          : undefined,
        confirmLabel: t('common.add', 'Ekle'),
        cancelLabel: t('common.exit', 'Çıkış'),
        cancelVariant: 'destructive',
        variant: 'primary',
        onConfirm: () => void runBulkAdd(),
      })
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : t('common.error'))
    } finally {
      setAddAllLdapLoading(false)
    }
  }

  useEffect(() => {
    if (!managementContext || !showForm) {
      return
    }

    const nextMode = readCreateMode(searchParams.get('mode'), managementContext)
    if (nextMode !== searchParams.get('mode')) {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('mode', nextMode)
      setSearchParams(nextSearchParams, { replace: true })
    }
  }, [managementContext, searchParams, setSearchParams, showForm])

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const nextSearchParams = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        nextSearchParams.delete(key)
      } else {
        nextSearchParams.set(key, value)
      }
    })

    setSearchParams(nextSearchParams, { replace: true })
  }

  const resetForm = () => {
    setNewUser(DEFAULT_USER_FORM)
    setDirectoryQuery('')
    setDirectoryResults([])
    setSelectedDirectoryUser(null)
  }

  const closeCreateForm = () => {
    resetForm()
    updateSearchParams({ create: null, mode: null })
  }

  const openCreateForm = () => {
    const initialMode = managementContext?.localUsersEnabled === false && managementContext?.ldapEnabled ? 'ldap' : 'manual'
    updateSearchParams({ create: '1', mode: initialMode })
  }

  const switchCreateMode = (nextMode: CreateMode) => {
    resetForm()
    updateSearchParams({ create: '1', mode: nextMode })
  }

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (newUser.roleCode === 'Manager' && newUser.departmentId) {
      const existingManager = getDepartmentManager(newUser.departmentId)
      if (existingManager) {
        setError(t('users.managerConflict', { name: existingManager.displayName }))
        return
      }
    }

    try {
      await api.createUser({
        username: createMode === 'ldap' ? newUser.username || null : newUser.username.trim() || null,
        displayName: newUser.displayName,
        email: newUser.email || null,
        password: createMode === 'manual' ? newUser.password : null,
        departmentId: newUser.departmentId || null,
        additionalDepartmentIds: newUser.additionalDepartmentIds.filter(id => id !== newUser.departmentId),
        roleCode: newUser.roleCode,
        additionalRoleCodes: newUser.additionalRoleCodes.filter(role => role !== newUser.roleCode),
        isActive: newUser.isActive,
        sourceType: createMode === 'ldap' ? 'Ldap' : 'Manual',
        externalIdentityId: createMode === 'ldap' ? newUser.externalIdentityId : null,
        ldapDepartmentName: createMode === 'ldap' ? selectedDirectoryUser?.department ?? null : null,
      })

      closeCreateForm()
      invalidateUsers(queryClient)
      loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const startEditing = (user: User) => {
    setEditingUserId(user.userId)
    setEditForm({
      displayName: user.displayName ?? '',
      title: user.title ?? '',
      email: user.email ?? '',
      departmentId: user.departmentId,
      additionalDepartmentIds: getUserDepartmentIds(user).filter(id => id !== user.departmentId),
      roleCode: user.roleCode,
      additionalRoleCodes: user.additionalRoleCodes ?? [],
      isActive: user.isActive,
    })
  }

  const cancelEditing = () => {
    setEditingUserId(null)
  }

  const handleUpdateUser = async (userId: string, userSource: string) => {
    setError('')

    const isManual = userSource === 'Manual'
    if (isManual && !editForm.displayName.trim()) {
      setError(t('users.displayNameRequired', 'Ad soyad zorunludur.'))
      return
    }

    if (editForm.roleCode === 'Manager' && editForm.departmentId) {
      const existingManager = getDepartmentManager(editForm.departmentId, userId)
      if (existingManager) {
        setError(t('users.managerConflict', { name: existingManager.displayName }))
        return
      }
    }

    try {
      await api.updateUser(userId, {
        departmentId: editForm.departmentId,
        additionalDepartmentIds: editForm.additionalDepartmentIds,
        roleCode: editForm.roleCode,
        additionalRoleCodes: editForm.additionalRoleCodes,
        isActive: editForm.isActive,
        ...(isManual ? {
          displayName: editForm.displayName.trim(),
          email: editForm.email.trim() || null,
          title: editForm.title.trim() || null,
        } : {}),
      })
      setEditingUserId(null)
      invalidateUsers(queryClient)
      loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({
      message: t('users.deleteConfirm', { name: user.displayName }),
      variant: 'destructive',
      onConfirm: async () => {
        setError('')
        try {
          await api.deleteUser(user.userId)
          invalidateUsers(queryClient)
          loadData()
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
        }
      },
    })
  }

  const directoryOptions = useMemo(() => directoryResults.map(result => ({
    id: result.externalIdentityId,
    label: result.displayName,
    description: [result.username, result.email, result.department].filter(Boolean).join(' • '),
    helperText: result.alreadyLinked ? t('users.alreadyLinked') : undefined,
    badgeText: result.alreadyLinked ? t('users.alreadyLinkedBadge') : 'LDAP',
    disabled: result.alreadyLinked,
  })), [directoryResults, t])

  const ldapModeReady = createMode !== 'ldap' || !!newUser.externalIdentityId
  const getDepartmentName = (departmentId: string) => departments.find(department => department.departmentId === departmentId)?.name || t('common.none')
  const { sortKey: usersSortKey, sortDir: usersSortDir, toggleSort: toggleUsersSort, sortItems: sortUsers } = useSortable()
  const sortedUsers = useMemo(() => sortUsers(users), [users, sortUsers])
  const { filters: userFilters, setFilter: setUserFilter, matchesFilters: userMatchesFilters } = useColumnFilters()
  const columnFilteredUsers = useMemo(
    () => sortedUsers.filter(u => userMatchesFilters(u)),
    [sortedUsers, userMatchesFilters],
  )
  const [usersPageSize, setUsersPageSize] = useState(25)
  const [usersPage, setUsersPage] = useState(1)
  const usersTotalCount = columnFilteredUsers.length
  const usersTotalPages = Math.max(1, Math.ceil(usersTotalCount / usersPageSize) || 1)
  const usersSafePage = Math.min(usersPage, usersTotalPages)
  const pagedUsers = useMemo(() => {
    const start = (usersSafePage - 1) * usersPageSize
    return columnFilteredUsers.slice(start, start + usersPageSize)
  }, [usersSafePage, usersPageSize, columnFilteredUsers])
  const handleUserFilter = (key: string, value: string) => {
    setUserFilter(key, value)
    setUsersPage(1)
  }
  const handleUsersSort = (key: string) => {
    toggleUsersSort(key)
    setUsersPage(1)
  }
  const handleUsersPageSizeChange = (size: number) => {
    setUsersPageSize(size)
    setUsersPage(1)
  }
  const summary = {
    total: users.length,
    active: users.filter(user => user.isActive).length,
    ldap: users.filter(user => user.userSource === 'Ldap').length,
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className={`page-stack desktop-page-shell admin-surface-page${showForm ? ' shrink-0' : ''}`}>
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('users.title')}</h1>
            <p className="page-subtitle">{t('users.subtitle')}</p>
          </div>
          {canManageUsers ? (
            <Button
              type="button"
              variant={showForm ? 'destructive' : 'primary'}
              onClick={showForm ? closeCreateForm : openCreateForm}
            >
              {showForm ? t('common.cancel') : t('users.new')}
            </Button>
          ) : null}
        </div>
      </header>

      <section className="metric-grid">
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
              <Users className="size-4.5" />
            </div>
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('users.summary.total')}</div>
              <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{summary.total}</div>
            </div>
          </div>
        </div>
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]">
              <ShieldUser className="size-4.5" />
            </div>
            <div className="inline-actions">
              <StatusPill tone="success">{summary.active} {t('users.summary.active')}</StatusPill>
              <StatusPill tone="info">{summary.ldap} LDAP</StatusPill>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {canManageUsers && showForm ? (
        <form className="form-card page-stack shrink-0" onSubmit={handleCreateUser}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('users.newFormTitle')}</h2>
            <p className="helper-copy">{t('users.newFormDescription')}</p>
          </div>

          <div className="grid gap-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.createMode')}</span>
              <div className="segmented-control">
                {managementContext?.localUsersEnabled !== false ? (
                  <button className={createMode === 'manual' ? 'active' : ''} onClick={() => switchCreateMode('manual')} type="button">
                    {t('users.manualMode')}
                  </button>
                ) : null}
                {managementContext?.ldapEnabled ? (
                  <button className={createMode === 'ldap' ? 'active' : ''} onClick={() => switchCreateMode('ldap')} type="button">
                    {t('users.ldapMode')}
                  </button>
                ) : null}
              </div>
            </label>
            <p className="helper-copy">{createMode === 'ldap' ? t('users.sourceLdapHint') : t('users.sourceManualHint')}</p>
          </div>

          {createMode === 'ldap' ? (
            <div className="section-card page-stack">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="ldap-section-title text-lg font-extrabold text-slate-950">{t('users.directorySearch')}</h3>
                  <button
                    type="button"
                    className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={directorySyncLoading}
                    onClick={() => void handleLiveLdapUserSync()}
                  >
                    {directorySyncLoading ? t('users.liveLdapSyncWorking') : t('users.liveLdapSync')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={addAllLdapLoading || directorySyncLoading}
                    onClick={() => void handleAddAllLdapUsersClick()}
                  >
                    {addAllLdapLoading ? t('users.addAllLdapWorking') : t('users.addAllLdap')}
                  </button>
                </div>
                {ldapUsersWithoutDepartment.length > 0 ? (
                  <div className="min-w-[16rem] max-w-md flex-1">
                    <SingleSelectDropdown
                      options={ldapUsersWithoutDepartment.map(item => ({
                        value: item.externalIdentityId,
                        label: item.displayName || item.username,
                      }))}
                      value={ldapUsersWithoutDepartmentValue}
                      onChange={setLdapUsersWithoutDepartmentValue}
                      placeholder={t('users.ldapUsersWithoutDepartment')}
                      emptyText={t('users.ldapUsersWithoutDepartmentEmpty')}
                      searchable
                      searchPlaceholder={t('common.search', 'Ara...')}
                    />
                  </div>
                ) : null}
              </div>
              <p className="helper-copy">{t('users.directorySearchDescription')}</p>
              <p className="helper-copy">{t('users.directoryLinkHint')}</p>
              {directorySyncMessage ? <p className="helper-copy">{directorySyncMessage}</p> : null}
              <AutocompleteField
                ariaLabel={t('users.directorySearchAria')}
                emptyMessage={t('users.directorySearchEmpty')}
                loadingMessage={t('users.directorySearchLoading')}
                options={directoryOptions}
                placeholder={t('users.directorySearchPlaceholder')}
                value={directoryQuery}
                onOptionSelect={option => {
                  const selected = directoryResults.find(result => result.externalIdentityId === option.id) ?? null
                  setSelectedDirectoryUser(selected)
                  setDirectoryQuery(option.label)

                  // LDAP seçiminde birim eşleştir; birim yoksa oluşturma — Oluştur + ldapDepartmentName (card #1729).
                  let matchedDepartmentId = ''
                  if (selected?.department) {
                    const normalizedLdap = selected.department.toLocaleLowerCase('tr')
                    const existing = departments.find(d => d.name.toLocaleLowerCase('tr') === normalizedLdap)
                    if (existing) {
                      matchedDepartmentId = existing.departmentId
                    }
                  }

                  setNewUser(current => ({
                    ...current,
                    username: selected?.username ?? current.username,
                    displayName: selected?.displayName ?? current.displayName,
                    // mail attribute yoksa boş bırak; UPN ile doldurma (card #1734).
                    email: selected?.email?.trim() ?? '',
                    password: '',
                    externalIdentityId: selected?.externalIdentityId ?? null,
                    departmentId: matchedDepartmentId || current.departmentId,
                  }))
                }}
                onValueChange={value => {
                  setDirectoryQuery(value)
                  if (value.trim().length < 2) {
                    setDirectoryResults([])
                  }
                  if (!value.trim()) {
                    setSelectedDirectoryUser(null)
                    setNewUser(current => ({ ...current, username: '', displayName: '', email: '', externalIdentityId: null }))
                  }
                }}
              />
              {selectedDirectoryUser ? (
                <div className="section-card">
                  <div className="font-semibold text-slate-950">{selectedDirectoryUser.displayName}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {selectedDirectoryUser.username}{selectedDirectoryUser.email ? ` • ${selectedDirectoryUser.email}` : ''}
                  </div>
                  {selectedDirectoryUser.department ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                      🏢 {selectedDirectoryUser.department}
                      {departments.some(d => d.name.toLocaleLowerCase('tr') === selectedDirectoryUser.department!.toLocaleLowerCase('tr'))
                        ? ' ✓'
                        : ` (${t('users.departmentWillBeCreated')})`}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.username')}</span>
              <input
                aria-label={t('users.username')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.usernamePlaceholder')}
                type="text"
                value={newUser.username}
                onChange={event => setNewUser(current => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.displayName')}</span>
              <input
                aria-label={t('users.displayName')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.displayNamePlaceholder')}
                type="text"
                value={newUser.displayName}
                onChange={event => setNewUser(current => ({ ...current, displayName: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.email')}</span>
              <input
                aria-label={t('users.email')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.emailPlaceholder')}
                type="email"
                value={newUser.email}
                onChange={event => setNewUser(current => ({ ...current, email: event.target.value }))}
              />
            </label>
          </div>

          {createMode === 'manual' ? (
            <label className="grid gap-2 text-sm font-semibold text-slate-700 md:max-w-[calc(50%-0.5rem)]">
              <span>
                {t('users.password')}{' '}
                <span className="text-xs font-normal text-slate-400">{t('users.passwordHint', '(Parola minimum 8 karakter, büyük harf, küçük harf, karakter, rakam içermelidir.)')}</span>
              </span>
              <input
                aria-label={t('users.password')}
                className="field-input"
                placeholder={t('users.passwordPlaceholder')}
                type="password"
                value={newUser.password}
                onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))}
              />
            </label>
          ) : null}

          {/* Birim / Ek birimler / Rol / Ek roller / Aktif / Oluştur TEK satırda.
              Rol dar; Rol+Ek roller menü metni küçük; Oluştur geniş ama alçak (card #1739 5. reopen).
              LDAP Dizin Hesabı alanı kaldırıldı (card #1755). Oluştur altında İptal Et → resetForm (card #1756). */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.55fr)_minmax(0,0.5fr)_auto_minmax(13rem,auto)] lg:items-start">
              <div className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.department')}</span>
                <SingleSelectDropdown
                  options={departments.map(department => ({
                    value: department.departmentId,
                    label: department.name,
                  }))}
                  value={newUser.departmentId}
                  onChange={departmentId => setNewUser(current => ({
                    ...current,
                    departmentId,
                    additionalDepartmentIds: current.additionalDepartmentIds.filter(id => id !== departmentId),
                  }))}
                  placeholder={t('tasks.selectDepartment')}
                  emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
              </div>

              <div className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.additionalDepartments', 'Ek görev yaptığı birimler')}</span>
                <MultiSelectDropdown
                  options={departments
                    .filter(department => department.departmentId !== newUser.departmentId)
                    .map(department => ({ value: department.departmentId, label: department.name }))}
                  value={newUser.additionalDepartmentIds}
                  onChange={additionalDepartmentIds => setNewUser(current => ({ ...current, additionalDepartmentIds }))}
                  placeholder={t('users.additionalDepartmentsPlaceholder', 'Ek birim seçiniz...')}
                  emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
                <span className="helper-copy">{t('users.additionalDepartmentsHelp', 'Kullanıcı bu birimler için sağ üstten aktif birimini değiştirebilir.')}</span>
              </div>

              <div className="users-role-field grid gap-2 font-semibold text-slate-700">
                <span className="text-sm">{t('users.role')}</span>
                <SingleSelectDropdown
                  className="users-role-dropdown"
                  triggerClassName="text-xs"
                  menuClassName="users-roles-compact-menu"
                  options={PRIMARY_ROLE_CODES.map(roleCode => ({
                    value: roleCode,
                    label: getRoleLabel(t, roleCode),
                  }))}
                  value={newUser.roleCode}
                  onChange={roleCode => setNewUser(current => ({
                    ...current,
                    roleCode,
                    additionalRoleCodes: current.additionalRoleCodes.filter(role => role !== roleCode),
                  }))}
                  placeholder={t('users.role')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
              </div>

              <div className="users-additional-roles-field grid gap-2 font-semibold text-slate-700">
                <span>{t('users.additionalRoles', 'Ek roller')}</span>
                <MultiSelectDropdown
                  className="users-additional-roles-dropdown"
                  triggerClassName="text-xs"
                  menuClassName="users-roles-compact-menu"
                  options={ADDITIONAL_ROLE_CODES
                    .filter(roleCode => roleCode !== newUser.roleCode)
                    .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))}
                  value={newUser.additionalRoleCodes}
                  onChange={additionalRoleCodes => setNewUser(current => ({ ...current, additionalRoleCodes }))}
                  placeholder={t('users.additionalRolesPlaceholder', 'Ek rol seçin')}
                  emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
                <span className="helper-copy">{t('users.additionalRolesHelp', 'Kullanıcı birincil role ek olarak birden fazla yetki alabilir.')}</span>
              </div>

              <div className="grid gap-2">
                <span aria-hidden="true" className="hidden text-sm font-semibold lg:block">&nbsp;</span>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={newUser.isActive} type="checkbox" onChange={event => setNewUser(current => ({ ...current, isActive: event.target.checked }))} />
                  {t('users.active')}
                </label>
              </div>

              <div className="grid gap-2">
                <span aria-hidden="true" className="hidden text-sm font-semibold lg:block">&nbsp;</span>
                <div className="inline-actions flex flex-col gap-2">
                  <Button
                    className="users-create-submit w-full min-w-[13rem] px-8 text-base"
                    disabled={!ldapModeReady}
                    type="submit"
                  >
                    {t('common.create')}
                  </Button>
                  {createMode === 'ldap' && selectedDirectoryUser ? (
                    <Button
                      className="w-full min-w-[13rem] px-8 text-base"
                      type="button"
                      variant="destructive"
                      onClick={() => resetForm()}
                    >
                      {t('common.cancelAction', 'İptal Et')}
                    </Button>
                  ) : null}
                </div>
              </div>
          </div>

          {newUser.roleCode === 'Manager' && newUser.departmentId && getDepartmentManager(newUser.departmentId) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠ {t('users.managerConflict', { name: getDepartmentManager(newUser.departmentId)!.displayName })}
            </div>
          ) : null}
        </form>
      ) : null}

      <section className={`section-card${showForm ? '' : ' desktop-page-fill'}`}>
        <div className={`table-wrap${showForm ? '' : ' desktop-panel-scroll'}`}>
          <table className="data-table users-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="username" filterValue={userFilters['username'] ?? ''} onFilter={handleUserFilter} sortKey="username" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.username')}</FilterableTh>
                <FilterableTh filterKey="displayName" filterValue={userFilters['displayName'] ?? ''} onFilter={handleUserFilter} sortKey="displayName" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.displayName')}</FilterableTh>
                <FilterableTh filterKey="title" filterValue={userFilters['title'] ?? ''} onFilter={handleUserFilter} sortKey="title" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.jobTitle')}</FilterableTh>
                <FilterableTh filterKey="email" filterValue={userFilters['email'] ?? ''} onFilter={handleUserFilter} sortKey="email" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.email')}</FilterableTh>
                <FilterableTh filterKey="departmentId" filterValue={userFilters['departmentId'] ?? ''} onFilter={handleUserFilter}>{t('users.department')}</FilterableTh>
                <FilterableTh filterKey="roleCode" filterValue={userFilters['roleCode'] ?? ''} onFilter={handleUserFilter} sortKey="roleCode" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.role')}</FilterableTh>
                <FilterableTh filterKey="userSource" filterValue={userFilters['userSource'] ?? ''} onFilter={handleUserFilter} sortKey="userSource" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.source')}</FilterableTh>
                <FilterableTh filterKey="isActive" filterValue={userFilters['isActive'] ?? ''} onFilter={handleUserFilter} sortKey="isActive" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.status')}</FilterableTh>
                {canManageUsers ? <th className="actions-column">{t('common.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((user, index) => (
                editingUserId === user.userId ? (
                  <tr key={user.userId} className="bg-slate-50">
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(usersSafePage - 1) * usersPageSize + index + 1}</td>
                    <td>{user.username || t('common.none')}</td>
                    <td>
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input min-w-[10rem] text-sm font-semibold"
                          value={editForm.displayName}
                          onChange={e => setEditForm(c => ({ ...c, displayName: e.target.value }))}
                          aria-label={t('users.displayName')}
                        />
                      ) : (
                        <span className="font-semibold">{user.displayName}</span>
                      )}
                    </td>
                    <td className="max-w-[10rem]">
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input w-full text-sm"
                          value={editForm.title}
                          onChange={e => setEditForm(c => ({ ...c, title: e.target.value }))}
                          aria-label={t('users.jobTitle')}
                        />
                      ) : (
                        <span className="block truncate text-slate-500 text-sm" title={user.title ?? undefined}>{user.title || '-'}</span>
                      )}
                    </td>
                    <td>
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input min-w-[12rem] text-sm"
                          type="email"
                          value={editForm.email}
                          onChange={e => setEditForm(c => ({ ...c, email: e.target.value }))}
                          aria-label={t('users.email')}
                        />
                      ) : (
                        <span>{user.email || t('common.none')}</span>
                      )}
                    </td>
                    <td className="w-[11rem] max-w-[11rem]">
                      <div className="grid w-full gap-1.5">
                        <SingleSelectDropdown
                          options={departments.map(department => ({
                            value: department.departmentId,
                            label: department.name,
                          }))}
                          value={editForm.departmentId}
                          onChange={departmentId => setEditForm(c => ({
                            ...c,
                            departmentId,
                            additionalDepartmentIds: c.additionalDepartmentIds.filter(id => id !== departmentId),
                          }))}
                          placeholder={t('tasks.selectDepartment')}
                          emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                          searchable
                          searchPlaceholder={t('common.search', 'Ara...')}
                          className="w-full"
                          triggerClassName="text-xs"
                          menuClassName="max-w-[14rem] users-edit-dropdown-menu"
                          menuScrollClassName="users-edit-dropdown-menu-scroll"
                        />
                        <MultiSelectDropdown
                          options={departments
                            .filter(department => department.departmentId !== editForm.departmentId)
                            .map(department => ({ value: department.departmentId, label: department.name }))}
                          value={editForm.additionalDepartmentIds}
                          onChange={additionalDepartmentIds => setEditForm(c => ({ ...c, additionalDepartmentIds }))}
                          placeholder={t('users.additionalDepartmentsShort', 'Ek birimler')}
                          emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
                          className="w-full"
                          triggerClassName="text-xs"
                        />
                      </div>
                    </td>
                    <td className="w-[9rem] max-w-[9rem]">
                      <div className="grid w-full gap-1.5">
                        <SingleSelectDropdown
                          options={PRIMARY_ROLE_CODES.map(roleCode => ({
                            value: roleCode,
                            label: getRoleLabel(t, roleCode),
                          }))}
                          value={editForm.roleCode}
                          onChange={roleCode => setEditForm(c => ({
                            ...c,
                            roleCode,
                            additionalRoleCodes: c.additionalRoleCodes.filter(role => role !== roleCode),
                          }))}
                          placeholder={t('users.role')}
                          searchable
                          searchPlaceholder={t('common.search', 'Ara...')}
                          className="w-full"
                          triggerClassName="text-xs"
                          menuClassName="max-w-[12rem] users-edit-dropdown-menu"
                          menuScrollClassName="users-edit-dropdown-menu-scroll"
                        />
                        <MultiSelectDropdown
                          options={ADDITIONAL_ROLE_CODES
                            .filter(roleCode => roleCode !== editForm.roleCode)
                            .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))}
                          value={editForm.additionalRoleCodes}
                          onChange={additionalRoleCodes => setEditForm(c => ({ ...c, additionalRoleCodes }))}
                          placeholder={t('users.additionalRolesShort', 'Ek roller')}
                          emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
                          className="w-full"
                          triggerClassName="text-xs"
                        />
                      </div>
                    </td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input className="field-checkbox" checked={editForm.isActive} type="checkbox" onChange={e => setEditForm(c => ({ ...c, isActive: e.target.checked }))} />
                        {editForm.isActive ? t('users.active') : t('users.inactive')}
                      </label>
                    </td>
                    <td className="actions-column">
                      <div className="row-actions">
                        <Button size="sm" type="button" onClick={() => handleUpdateUser(user.userId, user.userSource)}>{t('common.save')}</Button>
                        <Button size="sm" type="button" variant="secondary" onClick={cancelEditing}>{t('common.cancel')}</Button>
                        {editForm.roleCode === 'Manager' && editForm.departmentId && getDepartmentManager(editForm.departmentId, user.userId) ? (
                          <span className="text-xs font-medium text-amber-700" title={t('users.managerConflict', { name: getDepartmentManager(editForm.departmentId, user.userId)!.displayName })}>
                            ⚠ {getDepartmentManager(editForm.departmentId, user.userId)!.displayName}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.userId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(usersSafePage - 1) * usersPageSize + index + 1}</td>
                    <td>{user.username || t('common.none')}</td>
                    <td className="font-semibold">{user.displayName}</td>
                    <td className="max-w-[10rem]"><span className="block truncate text-slate-500 text-sm" title={user.title ?? undefined}>{user.title || '-'}</span></td>
                    <td>{user.email || t('common.none')}</td>
                    <td>
                      <div className="grid gap-1">
                        <span>{getDepartmentName(user.departmentId)}</span>
                        {getUserDepartmentIds(user).filter(id => id !== user.departmentId).length > 0 ? (
                          <span className="text-xs font-semibold text-slate-500">
                            + {getUserDepartmentIds(user).filter(id => id !== user.departmentId).map(getDepartmentName).join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="grid gap-1">
                        <StatusPill tone={user.roleCode === 'SystemAdmin' ? 'danger' : user.roleCode === 'Manager' ? 'warning' : 'info'}>{getRoleLabel(t, user.roleCode)}</StatusPill>
                        {(user.additionalRoleCodes ?? []).map(roleCode => (
                          <StatusPill key={roleCode} tone="neutral">{getRoleLabel(t, roleCode)}</StatusPill>
                        ))}
                      </div>
                    </td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <StatusPill tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? t('users.active') : t('users.inactive')}
                      </StatusPill>
                    </td>
                    {canManageUsers ? (
                      <td className="actions-column">
                        <div className="row-actions">
                          <button className="icon-action icon-action--labeled" title={t('common.edit')} aria-label={t('common.edit')} type="button" onClick={() => startEditing(user)}>
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t('common.edit')}</span>
                          </button>
                          {user.userId !== currentUser?.userId ? (
                            <button className="icon-action icon-action--labeled danger" title={t('common.delete')} aria-label={t('common.delete')} type="button" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="size-3.5" />
                              <span>{t('common.delete')}</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              ))}
              {pagedUsers.length === 0 ? (
                <TableEmptyStateRows
                  columnCount={canManageUsers ? 10 : 9}
                  message={t('users.empty')}
                />
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={usersTotalCount}
          pageSize={usersPageSize}
          currentPage={usersSafePage}
          onPageSizeChange={handleUsersPageSizeChange}
          onPageChange={setUsersPage}
        />
      </section>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
