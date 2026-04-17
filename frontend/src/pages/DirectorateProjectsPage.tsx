import { FolderKanban, Layers, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, ProjectDetail, ProjectSummary } from '../types/platform'

interface StageDraft {
  title: string
  description: string
}

function getStatusTone(status: string) {
  if (status === 'InProgress') return 'info' as const
  if (status === 'Completed') return 'success' as const
  return 'neutral' as const
}

function getApprovalTone(approved: boolean, requiresApproval: boolean) {
  if (!requiresApproval) return 'neutral' as const
  return approved ? 'success' as const : 'warning' as const
}

export function DirectorateProjectsPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    ownerDepartmentId: '',
  })
  const [stages, setStages] = useState<StageDraft[]>([])

  const canManage = currentUser?.role === 'SystemAdmin' || currentUser?.role === 'Manager'

  const loadData = () => {
    setLoading(true)
    setError('')

    void Promise.all([api.getProjects('Directorate'), api.getDepartments()])
      .then(([projectList, departmentList]) => {
        setProjects(projectList)
        setDepartments(departmentList)
      })
      .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDetail = async (projectId: string) => {
    setDetailLoading(true)
    try {
      const detail = await api.getProjectById(projectId)
      setSelectedProject(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newProject.title.trim() || !newProject.ownerDepartmentId) return

    setError('')
    try {
      await api.createDirectorateProject({
        title: newProject.title,
        description: newProject.description,
        ownerDepartmentId: newProject.ownerDepartmentId,
        stages: stages.map((s, i) => ({ title: s.title, description: s.description || undefined, displayOrder: i + 1 })),
      })
      setNewProject({ title: '', description: '', ownerDepartmentId: '' })
      setStages([])
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleApprove = async (projectId: string) => {
    setError('')
    try {
      await api.approveProject(projectId)
      loadData()
      if (selectedProject?.projectId === projectId) await loadDetail(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleReject = async (projectId: string) => {
    setError('')
    try {
      await api.rejectProject(projectId)
      loadData()
      if (selectedProject?.projectId === projectId) await loadDetail(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleUpdateProjectStatus = async (projectId: string, status: string) => {
    setError('')
    try {
      await api.updateProjectStatus(projectId, status)
      loadData()
      if (selectedProject?.projectId === projectId) await loadDetail(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleUpdateStageStatus = async (stageId: string, status: string) => {
    setError('')
    try {
      await api.updateStageStatus(stageId, status)
      if (selectedProject) await loadDetail(selectedProject.projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const addStage = () => setStages(prev => [...prev, { title: '', description: '' }])
  const removeStage = (index: number) => setStages(prev => prev.filter((_, i) => i !== index))
  const updateStage = (index: number, field: keyof StageDraft, value: string) => {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const summaryCards = useMemo(() => [
    { label: t('projects.status.Planned'), value: projects.filter(p => p.status === 'Planned').length, icon: FolderKanban },
    { label: t('projects.status.InProgress'), value: projects.filter(p => p.status === 'InProgress').length, icon: Layers },
    { label: t('projects.status.Completed'), value: projects.filter(p => p.status === 'Completed').length, icon: FolderKanban },
  ], [projects, t])

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell min-h-[calc(100dvh-5rem)] lg:min-h-0">
      <section className="section-card overflow-hidden p-0">
        <div
          className="grid gap-4 border-b border-white/10 px-4 py-5 text-white sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-2">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/68">{t('nav.directorateProjects')}</div>
            <h1 className="page-title !text-white">{t('projects.directorate.title')}</h1>
          </div>
          <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
            <StatusPill tone="info" className="bg-white/12 text-white ring-white/15">
              {t('projects.fields.stageCount')}: {projects.reduce((sum, p) => sum + p.stageCount, 0)}
            </StatusPill>
            {canManage ? (
              <Button type="button" onClick={() => setShowForm(prev => !prev)}>
                {showForm ? t('common.cancel') : t('projects.directorate.create')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {summaryCards.map(item => {
          const Icon = item.icon
          return (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-edge)]" key={item.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-3xl font-extrabold text-slate-950">{item.value}</div>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                  <Icon className="size-4.5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {showForm ? (
        <form className="section-card overflow-hidden p-0" onSubmit={handleCreate}>
          <div className="border-b border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-4 py-4 sm:px-5">
            <h2 className="text-xl font-extrabold text-slate-950">{t('projects.directorate.create')}</h2>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.directorate.titleField')}</span>
              <input
                className="field-input"
                type="text"
                value={newProject.title}
                onChange={e => setNewProject(prev => ({ ...prev, title: e.target.value }))}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.directorate.descriptionField')}</span>
              <textarea
                className="field-textarea"
                rows={3}
                value={newProject.description}
                onChange={e => setNewProject(prev => ({ ...prev, description: e.target.value }))}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.directorate.department')}</span>
              <select
                className="field-select"
                value={newProject.ownerDepartmentId}
                onChange={e => setNewProject(prev => ({ ...prev, ownerDepartmentId: e.target.value }))}
              >
                <option value="">{t('tasks.selectDepartment')}</option>
                {departments.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{t('projects.directorate.stages')}</span>
                <Button type="button" size="sm" variant="secondary" onClick={addStage}>
                  <Plus className="size-3.5" /> {t('projects.directorate.addStage')}
                </Button>
              </div>
              {stages.map((stage, index) => (
                <div key={index} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-3">
                  <div className="grid flex-1 gap-2">
                    <input
                      className="field-input"
                      placeholder={t('projects.directorate.stageTitle')}
                      type="text"
                      value={stage.title}
                      onChange={e => updateStage(index, 'title', e.target.value)}
                    />
                    <input
                      className="field-input"
                      placeholder={t('projects.directorate.stageDescription')}
                      type="text"
                      value={stage.description}
                      onChange={e => updateStage(index, 'description', e.target.value)}
                    />
                  </div>
                  <button type="button" className="self-start text-slate-400 hover:text-red-500" onClick={() => removeStage(index)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="inline-actions">
              <Button type="submit">{t('common.create')}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="section-card overflow-hidden p-0 desktop-page-fill">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-950">{t('projects.directorate.title')}</h2>
          </div>
          <StatusPill tone="info">{projects.length}</StatusPill>
        </div>

        {projects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">{t('projects.directorate.noProjects')}</div>
        ) : (
          <div className="table-wrap desktop-panel-scroll max-h-[min(68dvh,52rem)] rounded-none border-0 lg:max-h-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('projects.directorate.titleField')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('projects.directorate.department')}</th>
                  <th>{t('projects.fields.creator')}</th>
                  <th>{t('projects.fields.stageCount')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.projectId}>
                    <td>
                      <button type="button" className="text-left font-semibold text-slate-950 hover:underline" onClick={() => loadDetail(project.projectId)}>
                        {project.title}
                      </button>
                      {project.description ? <div className="text-sm text-slate-500">{project.description}</div> : null}
                    </td>
                    <td><StatusPill tone={getStatusTone(project.status)}>{t(`projects.status.${project.status}`)}</StatusPill></td>
                    <td>{project.ownerDepartmentName ?? '-'}</td>
                    <td>{project.createdByUserName ?? '-'}</td>
                    <td>{project.stageCount}</td>
                    <td className="w-[14rem] min-w-[14rem]">
                      <div className="table-stack">
                        {project.requiresApproval && !project.isApproved ? (
                          <StatusPill tone={getApprovalTone(project.isApproved, project.requiresApproval)}>
                            {t('projects.directorate.pendingApproval')}
                          </StatusPill>
                        ) : null}
                        {project.requiresApproval && project.isApproved ? (
                          <StatusPill tone="success">{t('projects.directorate.approved')}</StatusPill>
                        ) : null}
                        {canManage && project.requiresApproval && !project.isApproved ? (
                          <div className="inline-actions">
                            <Button size="sm" type="button" variant="success" onClick={() => handleApprove(project.projectId)}>{t('projects.directorate.approve')}</Button>
                            <Button size="sm" type="button" variant="danger" onClick={() => handleReject(project.projectId)}>{t('projects.directorate.reject')}</Button>
                          </div>
                        ) : null}
                        {canManage && project.status === 'Planned' ? (
                          <Button size="sm" type="button" onClick={() => handleUpdateProjectStatus(project.projectId, 'InProgress')}>{t('projects.status.InProgress')}</Button>
                        ) : null}
                        {canManage && project.status === 'InProgress' ? (
                          <Button size="sm" type="button" variant="success" onClick={() => handleUpdateProjectStatus(project.projectId, 'Completed')}>{t('projects.status.Completed')}</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProject ? (
        <section className="section-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-4 py-3 sm:px-5">
            <h2 className="text-base font-bold text-slate-950">{selectedProject.title}</h2>
            <Button size="sm" variant="secondary" onClick={() => setSelectedProject(null)}>{t('common.close')}</Button>
          </div>

          {detailLoading ? (
            <div className="px-5 py-6 text-sm text-[color:var(--color-muted-foreground)]">{t('common.loading')}</div>
          ) : (
            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('common.status')}</div>
                  <div className="mt-1"><StatusPill tone={getStatusTone(selectedProject.status)}>{t(`projects.status.${selectedProject.status}`)}</StatusPill></div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.directorate.department')}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{selectedProject.ownerDepartmentName ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.fields.creator')}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{selectedProject.createdByUserName ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.fields.createdAt')}</div>
                  <div className="mt-1 text-sm text-slate-700">{new Date(selectedProject.createdAtUtc).toLocaleDateString()}</div>
                </div>
              </div>

              {selectedProject.description ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.directorate.descriptionField')}</div>
                  <div className="mt-1 text-sm text-slate-700">{selectedProject.description}</div>
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-bold text-slate-950">{t('projects.directorate.stages')}</h3>
                {selectedProject.stages.length === 0 ? (
                  <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">—</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedProject.stages
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map(stage => (
                        <div key={stage.stageId} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-3">
                          <div>
                            <div className="font-semibold text-slate-950">{stage.displayOrder}. {stage.title}</div>
                            {stage.description ? <div className="text-sm text-slate-500">{stage.description}</div> : null}
                            {stage.responsibleDepartmentName ? <div className="text-xs text-slate-400">{stage.responsibleDepartmentName}</div> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusPill tone={getStatusTone(stage.status)}>{t(`projects.status.${stage.status}`)}</StatusPill>
                            {canManage && stage.status === 'Planned' ? (
                              <Button size="sm" type="button" onClick={() => handleUpdateStageStatus(stage.stageId, 'InProgress')}>{t('projects.status.InProgress')}</Button>
                            ) : null}
                            {canManage && stage.status === 'InProgress' ? (
                              <Button size="sm" type="button" variant="success" onClick={() => handleUpdateStageStatus(stage.stageId, 'Completed')}>{t('projects.status.Completed')}</Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
