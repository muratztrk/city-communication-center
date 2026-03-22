import { Building2, Layers3 } from 'lucide-react'
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

  const loadDepartments = () => {
    setLoading(true)
    setError('')

    void api.getDepartments()
      .then(setDepartments)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDepartments()
  }, [])

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
    <div className="page-stack">
      <header className="page-header-row">
        <div className="space-y-2">
          <h1 className="page-title">{t('departments.title')}</h1>
          <p className="page-subtitle">{t('departments.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setShowForm(current => !current)}>
          {showForm ? t('common.cancel') : t('departments.new')}
        </Button>
      </header>

      <section className="metric-grid">
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500">{t('departments.total')}</div>
              <div className="text-3xl font-extrabold text-slate-950">{departments.length}</div>
            </div>
          </div>
        </div>
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/18 text-[color:var(--color-primary)]">
              <Layers3 className="size-5" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-500">{t('departments.typeBreakdown')}</div>
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

      <section className="section-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('departments.name')}</th>
                <th>{t('departments.type')}</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(department => (
                <tr key={department.departmentId}>
                  <td className="font-semibold">{department.name}</td>
                  <td><StatusPill>{getDepartmentTypeLabel(t, department.departmentType)}</StatusPill></td>
                </tr>
              ))}
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={2}>
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