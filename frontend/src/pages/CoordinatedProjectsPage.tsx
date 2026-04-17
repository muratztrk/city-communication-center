import { Layers, Plus, Trash2, Workflow } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, ProjectDetail, ProjectSummary, UserLookup } from '../types/platform'

interface StageDraft {
  title: string
  description: string
  responsibleDepartmentId: string
}

function getStatusTone(status: string) {
  if (status === 'InProgress') return 'info' as const
  if (status === 'Completed') return 'success' as const
  return 'neutral' as const
}

function getApprovalStatusTone(status: string) {
  if (status === 'Approved') return 'success' as const
  if (status === 'Rejected') return 'danger' as const
  return 'warning' as const
}

export function CoordinatedProjectsPage() {
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
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
  const [stages, setStages] = useState<StageDraft[]>([])

  // Add member state
  const [memberQuery, setMemberQuery] = useState('')
  const [memberUsers, setMemberUsers] = useState<UserLookup[]>([])
  const [memberDepartmentId, setMemberDepartmentId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')

  const canManage = currentUser?.role === 'SystemAdmin' || currentUser?.role === 'Manager'

  const loadData = () => {
    setLoading(true)
    setError('')

    void Promise.all([api.getProjects('Coordinated'), api.getDepartments()])
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

  const searchMembers = async (query: string) => {
    if (query.length < 2) {
      setMemberUsers([])
      return
    }
    try {
      const results = await api.searchUsers(query, memberDepartmentId || undefined)
      setMemberUsers(results)
    } catch {
      setMemberUsers([])
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newProject.title.trim() || !newProject.ownerDepartmentId || selectedDepartmentIds.length < 2) return

    setError('')
    try {
      await api.createCoordinatedProject({
        title: newProject.title,
        description: newProject.description,
        ownerDepartmentId: newProject.ownerDepartmentId,
        departmentIds: selectedDepartmentIds,
        stages: stages.map((s, i) => ({
          title: s.title,
          description: s.description || undefined,
          displayOrder: i + 1,
          responsibleDepartmentId: s.responsibleDepartmentId || undefined,
        })),
      })
      setNewProject({ title: '', description: '', ownerDepartmentId: '' })
      setSelectedDepartmentIds([])
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

  const handleApproveDepartment = async (projectDepartmentId: string) => {
    setError('')
    try {
      await api.approveDepartmentJoin(projectDepartmentId)
      if (selectedProject) await loadDetail(selectedProject.projectId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleRejectDepartment = async (projectDepartmentId: string) => {
    setError('')
    try {
      await api.rejectDepartmentJoin(projectDepartmentId)
      if (selectedProject) await loadDetail(selectedProject.projectId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleAddMember = async () => {
    if (!selectedProject || !memberUserId || !memberDepartmentId) return
    setError('')
    try {
      await api.addProjectMember(selectedProject.projectId, memberUserId, memberDepartmentId)
      setMemberQuery('')
      setMemberUserId('')
      setMemberDepartmentId('')
      setMemberUsers([])
      await loadDetail(selectedProject.projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartmentIds(prev =>
      prev.includes(departmentId) ? prev.filter(id => id !== departmentId) : [...prev, departmentId],
    )
  }

  const addStage = () => setStages(prev => [...prev, { title: '', description: '', responsibleDepartmentId: '' }])
  const removeStage = (index: number) => setStages(prev => prev.filter((_, i) => i !== index))
  const updateStage = (index: number, field: keyof StageDraft, value: string) => {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const summaryCards = useMemo(() => [
    { label: t('projects.status.Planned'), value: projects.filter(p => p.status === 'Planned').length, icon: Workflow },
    { label: t('projects.status.InProgress'), value: projects.filter(p => p.status === 'InProgress').length, icon: Layers },
    { label: t('projects.status.Completed'), value: projects.filter(p => p.status === 'Completed').length, icon: Workflow },
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
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/68">{t('nav.coordinatedProjects')}</div>
            <h1 className="page-title !text-white">{t('projects.coordinated.title')}</h1>
          </div>
          <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
            <StatusPill tone="info" className="bg-white/12 text-white ring-white/15">
              {t('projects.fields.departmentCount')}: {projects.reduce((sum, p) => sum + p.departmentCount, 0)}
            </StatusPill>
            {canManage ? (
              <Button type="button" onClick={() => setShowForm(prev => !prev)}>
                {showForm ? t('common.cancel') : t('projects.coordinated.create')}
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
            <h2 className="text-xl font-extrabold text-slate-950">{t('projects.coordinated.create')}</h2>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.coordinated.titleField')}</span>
              <input
                className="field-input"
                type="text"
                value={newProject.title}
                onChange={e => setNewProject(prev => ({ ...prev, title: e.target.value }))}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.coordinated.descriptionField')}</span>
              <textarea
                className="field-textarea"
                rows={3}
                value={newProject.description}
                onChange={e => setNewProject(prev => ({ ...prev, description: e.target.value }))}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('projects.coordinated.coordinatorDepartment')}</span>
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

            <div className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">{t('projects.coordinated.departments')}</span>
              <p className="text-xs text-[color:var(--color-muted-foreground)]">{t('projects.coordinated.selectDepartments')}</p>
              <div className="flex flex-wrap gap-2">
                {departments.map(d => {
                  const isSelected = selectedDepartmentIds.includes(d.departmentId)
                  return (
                    <button
                      key={d.departmentId}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${isSelected
                        ? 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] ring-[color:var(--color-primary)]/30'
                        : 'bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100'
                      }`}
                      onClick={() => toggleDepartment(d.departmentId)}
                    >
                      {d.name}
                    </button>
                  )
                })}
              </div>
              {selectedDepartmentIds.length > 0 && selectedDepartmentIds.length < 2 ? (
                <p className="text-xs text-[color:var(--color-destructive)]">{t('projects.coordinated.selectDepartments')}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{t('projects.coordinated.stages')}</span>
                <Button type="button" size="sm" variant="secondary" onClick={addStage}>
                  <Plus className="size-3.5" /> {t('projects.coordinated.addStage')}
                </Button>
              </div>
              {stages.map((stage, index) => (
                <div key={index} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-3">
                  <div className="grid flex-1 gap-2">
                    <input
                      className="field-input"
                      placeholder={t('projects.coordinated.stageTitle')}
                      type="text"
                      value={stage.title}
                      onChange={e => updateStage(index, 'title', e.target.value)}
                    />
                    <input
                      className="field-input"
                      placeholder={t('projects.coordinated.stageDescription')}
                      type="text"
                      value={stage.description}
                      onChange={e => updateStage(index, 'description', e.target.value)}
                    />
                    <select
                      className="field-select"
                      value={stage.responsibleDepartmentId}
                      onChange={e => updateStage(index, 'responsibleDepartmentId', e.target.value)}
                    >
                      <option value="">{t('projects.coordinated.responsibleDepartment')}</option>
                      {departments
                        .filter(d => selectedDepartmentIds.includes(d.departmentId))
                        .map(d => (
                          <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                        ))}
                    </select>
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
            <h2 className="text-base font-bold text-slate-950">{t('projects.coordinated.title')}</h2>
          </div>
          <StatusPill tone="info">{projects.length}</StatusPill>
        </div>

        {projects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[color:var(--color-muted-foreground)]">{t('projects.coordinated.noProjects')}</div>
        ) : (
          <div className="table-wrap desktop-panel-scroll max-h-[min(68dvh,52rem)] rounded-none border-0 lg:max-h-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('projects.coordinated.titleField')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('projects.coordinated.coordinatorDepartment')}</th>
                  <th>{t('projects.fields.departmentCount')}</th>
                  <th>{t('projects.fields.memberCount')}</th>
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
                    <td>{project.departmentCount}</td>
                    <td>{project.memberCount}</td>
                    <td>{project.stageCount}</td>
                    <td className="w-[14rem] min-w-[14rem]">
                      <div className="table-stack">
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
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.coordinated.coordinatorDepartment')}</div>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.coordinated.descriptionField')}</div>
                  <div className="mt-1 text-sm text-slate-700">{selectedProject.description}</div>
                </div>
              ) : null}

              {/* Departments */}
              <div>
                <h3 className="text-sm font-bold text-slate-950">{t('projects.coordinated.departments')}</h3>
                {selectedProject.departments.length === 0 ? (
                  <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">—</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedProject.departments.map(dept => (
                      <div key={dept.projectDepartmentId} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-3">
                        <div>
                          <div className="font-semibold text-slate-950">{dept.departmentName}</div>
                          {dept.approvedByUserName ? (
                            <div className="text-xs text-slate-400">{dept.approvedByUserName}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone={getApprovalStatusTone(dept.approvalStatus)}>{t(`projects.approvalStatus.${dept.approvalStatus}`)}</StatusPill>
                          {canManage && dept.approvalStatus === 'Pending' ? (
                            <>
                              <Button size="sm" type="button" variant="success" onClick={() => handleApproveDepartment(dept.projectDepartmentId)}>{t('projects.coordinated.approveJoin')}</Button>
                              <Button size="sm" type="button" variant="danger" onClick={() => handleRejectDepartment(dept.projectDepartmentId)}>{t('projects.coordinated.rejectJoin')}</Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stages */}
              <div>
                <h3 className="text-sm font-bold text-slate-950">{t('projects.coordinated.stages')}</h3>
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
                            {stage.responsibleDepartmentName ? (
                              <div className="text-xs text-slate-400">{t('projects.coordinated.responsibleDepartment')}: {stage.responsibleDepartmentName}</div>
                            ) : null}
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

              {/* Members */}
              <div>
                <h3 className="text-sm font-bold text-slate-950">{t('projects.coordinated.members')}</h3>
                {selectedProject.members.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {selectedProject.members.map(member => (
                      <div key={member.projectMemberId} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-2 text-sm">
                        <span className="font-semibold text-slate-950">{member.userDisplayName}</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-slate-500">{member.departmentName}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {canManage ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{t('projects.coordinated.addMember')}</div>
                    <select
                      className="field-select"
                      value={memberDepartmentId}
                      onChange={e => {
                        setMemberDepartmentId(e.target.value)
                        setMemberUserId('')
                        setMemberQuery('')
                        setMemberUsers([])
                      }}
                    >
                      <option value="">{t('projects.coordinated.coordinatorDepartment')}</option>
                      {departments.map(d => (
                        <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                      ))}
                    </select>
                    <AutocompleteField
                      ariaLabel={t('projects.coordinated.addMember')}
                      emptyMessage={t('tasks.userSearchEmpty')}
                      loadingMessage={t('common.loading')}
                      options={memberUsers.map(u => ({
                        id: u.userId,
                        label: u.displayName,
                        description: u.departmentName,
                      }))}
                      placeholder={t('tasks.userSearchPlaceholder')}
                      value={memberQuery}
                      onOptionSelect={option => {
                        setMemberUserId(option.id)
                        setMemberQuery(option.label)
                      }}
                      onValueChange={value => {
                        setMemberQuery(value)
                        if (!value.trim()) {
                          setMemberUserId('')
                        }
                        void searchMembers(value)
                      }}
                    />
                    <Button size="sm" type="button" onClick={handleAddMember} disabled={!memberUserId || !memberDepartmentId}>
                      {t('projects.coordinated.addMember')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
