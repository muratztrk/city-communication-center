import type { FormEvent } from 'react'
import { Pencil, ShieldUser, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Department, DirectoryUserLookup, User, UserManagementContext } from '../types/platform'
import { getRoleLabel, getUserSourceLabel } from '../utils/localization'

type CreateMode = 'manual' | 'ldap'

const DEFAULT_USER_FORM = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  departmentId: '',
  roleCode: 'Staff',
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
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managementContext, setManagementContext] = useState<UserManagementContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState(DEFAULT_USER_FORM)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ departmentId: '', roleCode: '', isActive: true })
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([])
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserLookup | null>(null)

  const canManageUsers = currentUser?.role === 'SystemAdmin'
  const showForm = searchParams.get('create') === '1'
  const createMode = readCreateMode(searchParams.get('mode'), managementContext)
  const debouncedDirectoryQuery = useDebouncedValue(directoryQuery)
  const shouldSearchDirectory = showForm
    && createMode === 'ldap'
    && !!managementContext?.ldapEnabled
    && debouncedDirectoryQuery.trim().length >= 2

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

    try {
      await api.createUser({
        username: createMode === 'ldap' ? newUser.username || null : newUser.username.trim() || null,
        displayName: newUser.displayName,
        email: newUser.email || null,
        password: createMode === 'manual' ? newUser.password : null,
        departmentId: newUser.departmentId || null,
        roleCode: newUser.roleCode,
        isActive: newUser.isActive,
        sourceType: createMode === 'ldap' ? 'Ldap' : 'Manual',
        externalIdentityId: createMode === 'ldap' ? newUser.externalIdentityId : null,
        ldapDepartmentName: createMode === 'ldap' ? selectedDirectoryUser?.department ?? null : null,
      })

      closeCreateForm()
      loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const startEditing = (user: User) => {
    setEditingUserId(user.userId)
    setEditForm({ departmentId: user.departmentId, roleCode: user.roleCode, isActive: user.isActive })
  }

  const cancelEditing = () => {
    setEditingUserId(null)
  }

  const handleUpdateUser = async (userId: string) => {
    setError('')
    try {
      await api.updateUser(userId, editForm)
      setEditingUserId(null)
      loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(t('users.deleteConfirm', { name: user.displayName }))) {
      return
    }

    setError('')
    try {
      await api.deleteUser(user.userId)
      loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
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
                          const created = await api.createDepartment(selected.department, 'Müdürlük')
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
                <span>{t('users.password')}</span>
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
              <select aria-label={t('users.department')} className="field-select" value={newUser.departmentId} onChange={event => setNewUser(current => ({ ...current, departmentId: event.target.value }))}>
                <option value="">{t('tasks.selectDepartment')}</option>
                {departments.map(department => (
                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:items-end">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.role')}</span>
              <select aria-label={t('users.role')} className="field-select" value={newUser.roleCode} onChange={event => setNewUser(current => ({ ...current, roleCode: event.target.value }))}>
                {['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter'].map(roleCode => (
                  <option key={roleCode} value={roleCode}>{getRoleLabel(t, roleCode)}</option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input className="field-checkbox" checked={newUser.isActive} type="checkbox" onChange={event => setNewUser(current => ({ ...current, isActive: event.target.checked }))} />
              {t('users.active')}
            </label>
          </div>

          <div className="inline-actions">
            <Button disabled={!ldapModeReady} type="submit">{t('common.create')}</Button>
            <Button type="button" variant="secondary" onClick={closeCreateForm}>{t('common.cancel')}</Button>
          </div>
        </form>
      ) : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('users.username')}</th>
                <th>{t('users.displayName')}</th>
                <th>{t('users.email')}</th>
                <th>{t('users.department')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.source')}</th>
                <th>{t('users.status')}</th>
                {canManageUsers ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                editingUserId === user.userId ? (
                  <tr key={user.userId} className="bg-slate-50">
                    <td>{user.username || t('common.none')}</td>
                    <td className="font-semibold">{user.displayName}</td>
                    <td>{user.email || t('common.none')}</td>
                    <td>
                      <select className="field-select text-sm" value={editForm.departmentId} onChange={e => setEditForm(c => ({ ...c, departmentId: e.target.value }))}>
                        <option value="">{t('tasks.selectDepartment')}</option>
                        {departments.map(department => (
                          <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="field-select text-sm" value={editForm.roleCode} onChange={e => setEditForm(c => ({ ...c, roleCode: e.target.value }))}>
                        {['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter'].map(roleCode => (
                          <option key={roleCode} value={roleCode}>{getRoleLabel(t, roleCode)}</option>
                        ))}
                      </select>
                    </td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input className="field-checkbox" checked={editForm.isActive} type="checkbox" onChange={e => setEditForm(c => ({ ...c, isActive: e.target.checked }))} />
                        {editForm.isActive ? t('users.active') : t('users.inactive')}
                      </label>
                    </td>
                    <td>
                      <div className="inline-flex gap-1.5">
                        <Button size="sm" type="button" onClick={() => handleUpdateUser(user.userId)}>{t('common.save')}</Button>
                        <Button size="sm" type="button" variant="secondary" onClick={cancelEditing}>{t('common.cancel')}</Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.userId}>
                    <td>{user.username || t('common.none')}</td>
                    <td className="font-semibold">{user.displayName}</td>
                    <td>{user.email || t('common.none')}</td>
                    <td>{getDepartmentName(user.departmentId)}</td>
                    <td><StatusPill tone={user.roleCode === 'SystemAdmin' ? 'danger' : user.roleCode === 'Manager' ? 'warning' : 'info'}>{getRoleLabel(t, user.roleCode)}</StatusPill></td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <StatusPill tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? t('users.active') : t('users.inactive')}
                      </StatusPill>
                    </td>
                    {canManageUsers ? (
                      <td>
                        <div className="inline-flex gap-2">
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900" type="button" onClick={() => startEditing(user)}>
                            <Pencil className="size-3.5" />
                            {t('common.edit')}
                          </button>
                          {user.userId !== currentUser?.userId ? (
                            <button className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700" type="button" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="size-3.5" />
                              {t('common.delete')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={canManageUsers ? 8 : 7}>
                    <div className="empty-state">{t('users.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}