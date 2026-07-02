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
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
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
  const [editForm, setEditForm] = useState({ departmentId: '', additionalDepartmentIds: [] as string[], roleCode: '', additionalRoleCodes: [] as string[], isActive: true })
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([])
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserLookup | null>(null)
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

  const handleUpdateUser = async (userId: string) => {
    setError('')

    if (editForm.roleCode === 'Manager' && editForm.departmentId) {
      const existingManager = getDepartmentManager(editForm.departmentId, userId)
      if (existingManager) {
        setError(t('users.managerConflict', { name: existingManager.displayName }))
        return
      }
    }

    try {
      await api.updateUser(userId, editForm)
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
  const summary = {
    total: users.length,
    active: users.filter(user => user.isActive).length,
    ldap: users.filter(user => user.userSource === 'Ldap').length,
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('users.title')}</h1>
            <p className="page-subtitle">{t('users.subtitle')}</p>
          </div>
          {canManageUsers ? (
            <Button type="button" onClick={showForm ? closeCreateForm : openCreateForm}>
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
        <form className="form-card page-stack" onSubmit={handleCreateUser}>
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
              <div>
                <h3 className="text-lg font-extrabold text-slate-950">{t('users.directorySearch')}</h3>
                <p className="helper-copy">{t('users.directorySearchDescription')}</p>
                <p className="helper-copy">{t('users.directoryLinkHint')}</p>
              </div>
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

                  // Auto-match or auto-create department from LDAP
                  const resolveDepartment = async () => {
                    let matchedDepartmentId = ''
                    if (selected?.department) {
                      const normalizedLdap = selected.department.toLocaleLowerCase('tr')
                      const existing = departments.find(d => d.name.toLocaleLowerCase('tr') === normalizedLdap)
                      if (existing) {
                        matchedDepartmentId = existing.departmentId
                      } else {
                        try {
                          const created = await api.createDepartment({ name: selected.department, departmentType: 'Müdürlük' })
                          const refreshed = await api.getDepartments()
                          setDepartments(refreshed)
                          matchedDepartmentId = created.departmentId
                        } catch {
                          // Silently fall back — user can pick manually
                        }
                      }
                    }

                    setNewUser(current => ({
                      ...current,
                      username: selected?.username ?? current.username,
                      displayName: selected?.displayName ?? current.displayName,
                      email: selected?.email ?? current.email,
                      password: '',
                      externalIdentityId: selected?.externalIdentityId ?? null,
                      departmentId: matchedDepartmentId || current.departmentId,
                    }))
                  }

                  void resolveDepartment()
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

          <div className="grid gap-4 md:grid-cols-2">
            {createMode === 'manual' ? (
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
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
            ) : (
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.externalIdentity')}</span>
                <input aria-label={t('users.externalIdentity')} className="field-input" disabled value={selectedDirectoryUser?.username ?? t('users.directorySelectionRequired')} />
              </label>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.department')}</span>
              <select
                aria-label={t('users.department')}
                className="field-select"
                value={newUser.departmentId}
                onChange={event => setNewUser(current => ({
                  ...current,
                  departmentId: event.target.value,
                  additionalDepartmentIds: current.additionalDepartmentIds.filter(id => id !== event.target.value),
                }))}
              >
                <option value="">{t('tasks.selectDepartment')}</option>
                {departments.map(department => (
                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>{t('users.additionalDepartments', 'Ek görev yaptığı birimler')}</span>
            <MultiSelectDropdown
              options={departments
                .filter(department => department.departmentId !== newUser.departmentId)
                .map(department => ({ value: department.departmentId, label: department.name }))}
              value={newUser.additionalDepartmentIds}
              onChange={additionalDepartmentIds => setNewUser(current => ({ ...current, additionalDepartmentIds }))}
              placeholder={t('users.additionalDepartmentsPlaceholder', 'Ek birim/müdürlük seçin')}
              emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
            />
            <span className="helper-copy">{t('users.additionalDepartmentsHelp', 'Kullanıcı bu birimler için sağ üstten aktif birimini değiştirebilir.')}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:items-end">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.role')}</span>
              <select aria-label={t('users.role')} className="field-select" value={newUser.roleCode} onChange={event => setNewUser(current => ({
                ...current,
                roleCode: event.target.value,
                additionalRoleCodes: current.additionalRoleCodes.filter(role => role !== event.target.value),
              }))}>
                {PRIMARY_ROLE_CODES.map(roleCode => (
                  <option key={roleCode} value={roleCode}>{getRoleLabel(t, roleCode)}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.additionalRoles', 'Ek roller')}</span>
              <MultiSelectDropdown
                options={ADDITIONAL_ROLE_CODES
                  .filter(roleCode => roleCode !== newUser.roleCode)
                  .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))}
                value={newUser.additionalRoleCodes}
                onChange={additionalRoleCodes => setNewUser(current => ({ ...current, additionalRoleCodes }))}
                placeholder={t('users.additionalRolesPlaceholder', 'Ek rol seçin')}
                emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
              />
              <span className="helper-copy">{t('users.additionalRolesHelp', 'Kullanıcı birincil role ek olarak birden fazla yetki alabilir.')}</span>
            </div>

            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input className="field-checkbox" checked={newUser.isActive} type="checkbox" onChange={event => setNewUser(current => ({ ...current, isActive: event.target.checked }))} />
              {t('users.active')}
            </label>
          </div>

          {newUser.roleCode === 'Manager' && newUser.departmentId && getDepartmentManager(newUser.departmentId) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠ {t('users.managerConflict', { name: getDepartmentManager(newUser.departmentId)!.displayName })}
            </div>
          ) : null}

          <div className="inline-actions">
            <Button disabled={!ldapModeReady} type="submit">{t('common.create')}</Button>
            <Button type="button" variant="secondary" onClick={closeCreateForm}>{t('common.cancel')}</Button>
          </div>
        </form>
      ) : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table users-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="username" filterValue={userFilters['username'] ?? ''} onFilter={setUserFilter} sortKey="username" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.username')}</FilterableTh>
                <FilterableTh filterKey="displayName" filterValue={userFilters['displayName'] ?? ''} onFilter={setUserFilter} sortKey="displayName" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.displayName')}</FilterableTh>
                <FilterableTh filterKey="title" filterValue={userFilters['title'] ?? ''} onFilter={setUserFilter} sortKey="title" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.jobTitle')}</FilterableTh>
                <FilterableTh filterKey="email" filterValue={userFilters['email'] ?? ''} onFilter={setUserFilter} sortKey="email" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.email')}</FilterableTh>
                <FilterableTh filterKey="departmentId" filterValue={userFilters['departmentId'] ?? ''} onFilter={setUserFilter}>{t('users.department')}</FilterableTh>
                <FilterableTh filterKey="roleCode" filterValue={userFilters['roleCode'] ?? ''} onFilter={setUserFilter} sortKey="roleCode" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.role')}</FilterableTh>
                <FilterableTh filterKey="userSource" filterValue={userFilters['userSource'] ?? ''} onFilter={setUserFilter} sortKey="userSource" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.source')}</FilterableTh>
                <FilterableTh filterKey="isActive" filterValue={userFilters['isActive'] ?? ''} onFilter={setUserFilter} sortKey="isActive" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={toggleUsersSort}>{t('users.status')}</FilterableTh>
                {canManageUsers ? <th className="actions-column" aria-label={t('common.actions')} /> : null}
              </tr>
            </thead>
            <tbody>
              {columnFilteredUsers.map((user, index) => (
                editingUserId === user.userId ? (
                  <tr key={user.userId} className="bg-slate-50">
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{index + 1}</td>
                    <td>{user.username || t('common.none')}</td>
                    <td className="font-semibold">{user.displayName}</td>
                    <td className="max-w-[10rem]"><span className="block truncate text-slate-500 text-sm" title={user.title ?? undefined}>{user.title || '-'}</span></td>
                    <td>{user.email || t('common.none')}</td>
                    <td>
                      <div className="grid min-w-[16rem] gap-2">
                        <select
                          className="field-select text-sm"
                          value={editForm.departmentId}
                          onChange={e => setEditForm(c => ({
                            ...c,
                            departmentId: e.target.value,
                            additionalDepartmentIds: c.additionalDepartmentIds.filter(id => id !== e.target.value),
                          }))}
                        >
                          <option value="">{t('tasks.selectDepartment')}</option>
                          {departments.map(department => (
                            <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                          ))}
                        </select>
                        <MultiSelectDropdown
                          options={departments
                            .filter(department => department.departmentId !== editForm.departmentId)
                            .map(department => ({ value: department.departmentId, label: department.name }))}
                          value={editForm.additionalDepartmentIds}
                          onChange={additionalDepartmentIds => setEditForm(c => ({ ...c, additionalDepartmentIds }))}
                          placeholder={t('users.additionalDepartmentsShort', 'Ek birimler')}
                          emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="grid min-w-[14rem] gap-2">
                        <select className="field-select text-sm" value={editForm.roleCode} onChange={e => setEditForm(c => ({
                          ...c,
                          roleCode: e.target.value,
                          additionalRoleCodes: c.additionalRoleCodes.filter(role => role !== e.target.value),
                        }))}>
                          {PRIMARY_ROLE_CODES.map(roleCode => (
                            <option key={roleCode} value={roleCode}>{getRoleLabel(t, roleCode)}</option>
                          ))}
                        </select>
                        <MultiSelectDropdown
                          options={ADDITIONAL_ROLE_CODES
                            .filter(roleCode => roleCode !== editForm.roleCode)
                            .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))}
                          value={editForm.additionalRoleCodes}
                          onChange={additionalRoleCodes => setEditForm(c => ({ ...c, additionalRoleCodes }))}
                          placeholder={t('users.additionalRolesShort', 'Ek roller')}
                          emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
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
                        <Button size="sm" type="button" onClick={() => handleUpdateUser(user.userId)}>{t('common.save')}</Button>
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
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{index + 1}</td>
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
                          <button className="icon-action" title={t('common.edit')} aria-label={t('common.edit')} type="button" onClick={() => startEditing(user)}>
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          {user.userId !== currentUser?.userId ? (
                            <button className="icon-action danger" title={t('common.delete')} aria-label={t('common.delete')} type="button" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              ))}
              {columnFilteredUsers.length === 0 ? (
                <TableEmptyStateRows
                  columnCount={canManageUsers ? 10 : 9}
                  message={t('users.empty')}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
