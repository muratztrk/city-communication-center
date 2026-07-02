import { Building2, Layers3, PenLine, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { api } from '../api/client'
import { invalidateDepartments } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { Button } from '../components/ui/button'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { useAuth } from '../context/AuthContext'
import type { Department, User } from '../types/platform'
import { userWorksInDepartment } from '../utils/userDepartments'
import { getDepartmentTypeLabel } from '../utils/localization'

export function DepartmentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Müdürlük')
  const [newManagerUserId, setNewManagerUserId] = useState('')
  const [newResponsibleUserIds, setNewResponsibleUserIds] = useState<string[]>([])

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editManagerUserId, setEditManagerUserId] = useState('')
  const [editResponsibleUserIds, setEditResponsibleUserIds] = useState<string[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [managerAssignId, setManagerAssignId] = useState<string | null>(null)
  const [managerAssignSavingId, setManagerAssignSavingId] = useState<string | null>(null)

  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments.list(),
    queryFn: () => api.getDepartments(),
  })
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => api.getUsers().catch(() => [] as User[]),
  })
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const loading = departmentsQuery.isLoading || usersQuery.isLoading

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newName.trim()) {
      return
    }

    try {
      await api.createDepartment({
        name: newName.trim(),
        departmentType: newType,
        managerUserId: newManagerUserId || null,
        responsibleUserIds: newResponsibleUserIds,
      })
      setNewName('')
      setNewType('Müdürlük')
      setNewManagerUserId('')
      setNewResponsibleUserIds([])
      setShowForm(false)
      invalidateDepartments(queryClient)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const startEdit = (department: Department) => {
    setEditId(department.departmentId)
    setEditName(department.name)
    setEditType(department.departmentType)
    setEditManagerUserId(department.managerUserId ?? '')
    setEditResponsibleUserIds(department.responsibleUserIds ?? [])
    setDeleteConfirmId(null)
    setManagerAssignId(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditType('')
    setEditManagerUserId('')
    setEditResponsibleUserIds([])
  }

  const handleUpdate = async (departmentId: string) => {
    if (!editName.trim()) {
      return
    }

    try {
      await api.updateDepartment(departmentId, {
        name: editName.trim(),
        departmentType: editType,
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

  const { filters: deptFilters, setFilter: setDeptFilter, matchesFilters: deptMatchesFilters } = useColumnFilters()
  const columnFilteredDepts = useMemo(
    () => departments.filter(d => deptMatchesFilters(d)),
    [departments, deptMatchesFilters],
  )

  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'
  const getManagerCandidates = () => users.filter(item => item.isActive)
  const userBelongsToDepartment = (item: User, departmentId?: string) => {
    if (!departmentId) return true
    return userWorksInDepartment(item, departmentId)
  }
  const getDepartmentUsers = (departmentId?: string) => users.filter(item => item.isActive && userBelongsToDepartment(item, departmentId))
  const getUserOptions = (sourceUsers: User[]) => sourceUsers.map(item => ({ value: item.userId, label: item.displayName }))
  const canEditDepartment = (department: Department) => user?.role === 'SystemAdmin' || department.managerUserId === user?.userId

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('departments.title')}</h1>
            <p className="page-subtitle">{t('departments.subtitle')}</p>
          </div>
          <Button type="button" onClick={() => setShowForm(current => !current)}>
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
        <form className="form-card page-stack" onSubmit={handleCreate}>
          <div className="page-header-row">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{t('departments.newFormTitle')}</h2>
              <p className="helper-copy">{t('departments.newFormDescription')}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('departments.name')}</span>
              <input
                className="field-input"
                placeholder={t('departments.namePlaceholder')}
                type="text"
                value={newName}
                onChange={event => setNewName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('departments.type')}</span>
              <select className="field-select" value={newType} onChange={event => setNewType(event.target.value)}>
                <option value="Müdürlük">{getDepartmentTypeLabel(t, 'Müdürlük')}</option>
                <option value="Birim">{getDepartmentTypeLabel(t, 'Birim')}</option>
                <option value="Daire">{getDepartmentTypeLabel(t, 'Daire')}</option>
                <option value="Administration">{getDepartmentTypeLabel(t, 'Administration')}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('departments.manager', 'Müdür')}</span>
              <select className="field-select" value={newManagerUserId} onChange={event => setNewManagerUserId(event.target.value)}>
                <option value="">{t('common.optional', '— Seçin (opsiyonel)')}</option>
                {users.filter(item => item.isActive).map(item => (
                  <option key={item.userId} value={item.userId}>{item.displayName}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
              <span>{t('departments.responsibles', 'Sorumlular')}</span>
              <MultiSelectDropdown
                options={getUserOptions(users.filter(item => item.isActive))}
                value={newResponsibleUserIds}
                onChange={setNewResponsibleUserIds}
                placeholder={t('departments.responsiblesPlaceholder', 'Sorumlu kullanıcı seçin')}
                emptyText={t('departments.responsiblesEmpty', 'Aktif kullanıcı bulunmuyor.')}
              />
              <span className="helper-copy">{t('departments.responsiblesHelp', 'Birden fazla kullanıcı seçebilirsiniz.')}</span>
            </div>
          </div>
          <div className="inline-actions">
            <Button type="submit">{t('common.create')}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      ) : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <FilterableTh filterKey="name" filterValue={deptFilters['name'] ?? ''} onFilter={setDeptFilter}>{t('departments.name')}</FilterableTh>
                <FilterableTh filterKey="departmentType" filterValue={deptFilters['departmentType'] ?? ''} onFilter={setDeptFilter}>{t('departments.type')}</FilterableTh>
                <th>{t('departments.manager', 'Müdür')}</th>
                <th>{t('departments.responsibles', 'Sorumlular')}</th>
                <th className="w-56">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {columnFilteredDepts.map(department => {
                const isManagerAssigning = managerAssignId === department.departmentId
                const isManagerSaving = managerAssignSavingId === department.departmentId

                return (
                  <tr key={department.departmentId}>
                    <td className="font-semibold">{department.name}</td>
                    <td><StatusPill>{getDepartmentTypeLabel(t, department.departmentType)}</StatusPill></td>
                    <td>
                      {isManagerAssigning ? (
                        <select
                          aria-label={t('departments.assignManager', 'Yönetici Ata')}
                          className="field-select min-w-52"
                          value={department.managerUserId ?? ''}
                          disabled={isManagerSaving}
                          onChange={event => void assignDepartmentManager(department, event.target.value || null)}
                        >
                          <option value="">{t('departments.noManager', '— Müdür Yok —')}</option>
                          {getManagerCandidates().map(item => (
                            <option key={item.userId} value={item.userId}>{item.displayName}</option>
                          ))}
                        </select>
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
                    <td>
                        {deleteConfirmId === department.departmentId ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-red-600">{t('departments.deleteConfirm', { name: department.name })}</span>
                            <div className="inline-actions">
                              <Button size="sm" variant="destructive" onClick={() => void handleDelete(department.departmentId)}>
                                {t('common.delete')}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setDeleteConfirmId(null)}>
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-actions justify-end">
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
                                <button className="icon-btn text-slate-500 hover:text-[color:var(--color-primary)]" title={t('common.edit')} type="button" onClick={() => startEdit(department)}>
                                  <PenLine className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                </button>
                              </>
                            ) : null}
                            <button className="icon-btn text-slate-400 hover:text-red-600" title={t('common.delete')} type="button" onClick={() => { setDeleteConfirmId(department.departmentId); setEditId(null); setManagerAssignId(null) }}>
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                    </td>
                  </tr>
                )
              })}
              {columnFilteredDepts.length === 0 ? (
                <TableEmptyStateRows columnCount={5} message={t('departments.empty')} />
              ) : null}
            </tbody>
          </table>
        </div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('departments.name')}</span>
                <input className="field-input" type="text" value={editName} onChange={event => setEditName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('departments.type')}</span>
                <select className="field-select" value={editType} onChange={event => setEditType(event.target.value)}>
                  <option value="Müdürlük">{getDepartmentTypeLabel(t, 'Müdürlük')}</option>
                  <option value="Birim">{getDepartmentTypeLabel(t, 'Birim')}</option>
                  <option value="Daire">{getDepartmentTypeLabel(t, 'Daire')}</option>
                  <option value="Administration">{getDepartmentTypeLabel(t, 'Administration')}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                <span>{t('departments.manager', 'Müdür')}</span>
                <select className="field-select" value={editManagerUserId} onChange={event => setEditManagerUserId(event.target.value)}>
                  <option value="">{t('common.optional', '— Seçin (opsiyonel)')}</option>
                  {getManagerCandidates().map(item => (
                    <option key={item.userId} value={item.userId}>{item.displayName}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                <span>{t('departments.responsibles', 'Sorumlular')}</span>
                <MultiSelectDropdown
                  options={getUserOptions(getDepartmentUsers(editId))}
                  value={editResponsibleUserIds}
                  onChange={setEditResponsibleUserIds}
                  placeholder={t('departments.responsiblesPlaceholder', 'Sorumlu kullanıcı seçin')}
                  emptyText={t('departments.responsiblesEmpty', 'Aktif kullanıcı bulunmuyor.')}
                />
                <span className="helper-copy">{t('departments.responsiblesHelp', 'Birden fazla kullanıcı seçebilirsiniz.')}</span>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={cancelEdit}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
