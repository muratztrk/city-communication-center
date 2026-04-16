import { Building2, Check, Layers3, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import type { Department } from '../types/platform'
import { getDepartmentTypeLabel } from '../utils/localization'

export function DepartmentsPage() {
  const { t } = useTranslation()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Müdürlük')

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadDepartments = () => {
    setLoading(true)
    setError('')

    void api.getDepartments()
      .then(setDepartments)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let isActive = true

    void api.getDepartments()
      .then(loadedDepartments => {
        if (isActive) {
          setDepartments(loadedDepartments)
        }
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
  }, [t])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newName.trim()) {
      return
    }

    try {
      await api.createDepartment(newName.trim(), newType)
      setNewName('')
      setNewType('Müdürlük')
      setShowForm(false)
      loadDepartments()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const startEdit = (department: Department) => {
    setEditId(department.departmentId)
    setEditName(department.name)
    setEditType(department.departmentType)
    setDeleteConfirmId(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditType('')
  }

  const handleUpdate = async (departmentId: string) => {
    if (!editName.trim()) {
      return
    }

    try {
      await api.updateDepartment(departmentId, editName.trim(), editType)
      cancelEdit()
      loadDepartments()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleDelete = async (departmentId: string) => {
    try {
      await api.deleteDepartment(departmentId)
      setDeleteConfirmId(null)
      loadDepartments()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
  }

  const typeSummary = useMemo(() => {
    return departments.reduce<Record<string, number>>((summary, department) => {
      summary[department.departmentType] = (summary[department.departmentType] ?? 0) + 1
      return summary
    }, {})
  }, [departments])

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
              </select>
            </label>
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
                <th>{t('departments.name')}</th>
                <th>{t('departments.type')}</th>
                <th className="w-28">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(department => (
                <tr key={department.departmentId}>
                  {editId === department.departmentId ? (
                    <>
                      <td>
                        <input
                          className="field-input"
                          type="text"
                          value={editName}
                          onChange={event => setEditName(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') { event.preventDefault(); void handleUpdate(department.departmentId) }
                            if (event.key === 'Escape') cancelEdit()
                          }}
                        />
                      </td>
                      <td>
                        <select className="field-select" value={editType} onChange={event => setEditType(event.target.value)}>
                          <option value="Müdürlük">{getDepartmentTypeLabel(t, 'Müdürlük')}</option>
                          <option value="Birim">{getDepartmentTypeLabel(t, 'Birim')}</option>
                          <option value="Daire">{getDepartmentTypeLabel(t, 'Daire')}</option>
                        </select>
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button className="icon-btn text-green-600" title={t('common.save')} type="button" onClick={() => void handleUpdate(department.departmentId)}>
                            <Check className="size-4" />
                          </button>
                          <button className="icon-btn text-slate-400" title={t('common.cancel')} type="button" onClick={cancelEdit}>
                            <X className="size-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-semibold">{department.name}</td>
                      <td><StatusPill>{getDepartmentTypeLabel(t, department.departmentType)}</StatusPill></td>
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
                          <div className="inline-actions">
                            <button className="icon-btn text-slate-500 hover:text-[color:var(--color-primary)]" title={t('common.edit')} type="button" onClick={() => startEdit(department)}>
                              <Pencil className="size-4" />
                            </button>
                            <button className="icon-btn text-slate-400 hover:text-red-600" title={t('common.delete')} type="button" onClick={() => { setDeleteConfirmId(department.departmentId); setEditId(null) }}>
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <div className="empty-state">{t('departments.empty')}</div>
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