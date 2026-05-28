import { MapPin } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { StatusPill } from '../components/ui/status-pill'
import type { Department, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel, getSocialStatusLabel } from '../utils/localization'

function getStatusTone(status: string) {
  if (status === 'ConvertedToTask') return 'success' as const
  if (status === 'Routed') return 'info' as const
  if (status === 'Closed') return 'neutral' as const
  return 'warning' as const
}

function hasLocation(message: SocialMessage) {
  return message.latitude != null && message.longitude != null
}

function getLocationMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.005).toFixed(6)},${(latitude - 0.005).toFixed(6)},${(longitude + 0.005).toFixed(6)},${(latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${latitude},${longitude}`
}

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const channelFilter = searchParams.get('channel') ?? ''
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routeDrafts, setRouteDrafts] = useState<Record<string, { departmentId: string }>>({})
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({})
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  useEffect(() => {
    let isActive = true

    void Promise.all([
      api.getSocialMessages(),
      api.getDepartments(),
    ])
      .then(([messageList, departmentList]) => {
        if (!isActive) {
          return
        }

        setMessages(messageList)
        setDepartments(departmentList)
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

  const reload = async () => {
    setLoading(true)
    setError('')

    try {
      const [messageList, departmentList] = await Promise.all([
        api.getSocialMessages(),
        api.getDepartments(),
      ])

      setMessages(messageList)
      setDepartments(departmentList)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleRoute = async (socialMessageId: string) => {
    const draft = routeDrafts[socialMessageId]
    const departmentId = draft?.departmentId || undefined

    if (!departmentId) {
      return
    }

    try {
      await api.routeSocialMessage(socialMessageId, departmentId)
      await reload()
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : t('common.error'))
    }
  }

  const handleConvert = async (socialMessageId: string, citizenHandle: string) => {
    const title = taskTitles[socialMessageId]?.trim() || t('social.defaultTaskTitle', { handle: citizenHandle })
    const message = messages.find(m => m.socialMessageId === socialMessageId)
    const ownerDepartmentId =
      routeDrafts[socialMessageId]?.departmentId ||
      message?.assignedDepartmentId ||
      ''
    if (!ownerDepartmentId) {
      setError(t('social.ownerDepartmentRequired', 'Önce bir müdürlük seçin.'))
      return
    }

    try {
      await api.convertSocialMessageToJob(socialMessageId, {
        title,
        description: t('social.defaultTaskDescription', { handle: citizenHandle }),
        ownerDepartmentId,
        priority: 'Normal',
        dueDateUtc: null,
      })
      await reload()
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : t('common.error'))
    }
  }

  const handleDelete = (socialMessageId: string) => {
    setConfirmDialog({
      message: t('social.deleteConfirm'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.deleteSocialMessage(socialMessageId)
          setMessages(current => current.filter(m => m.socialMessageId !== socialMessageId))
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
        }
      },
    })
  }

  const { sortKey: socialSortKey, sortDir: socialSortDir, toggleSort: toggleSocialSort, sortItems: sortSocial } = useSortable()

  const { filters: socialFilters, setFilter: setSocialFilter, matchesFilters: socialMatchesFilters } = useColumnFilters()

  const filteredMessages = useMemo(
    () => sortSocial(channelFilter ? messages.filter(m => m.channel === channelFilter) : messages),
    [messages, channelFilter, sortSocial],
  )

  const columnFilteredMessages = useMemo(
    () => filteredMessages.filter(m => socialMatchesFilters(m)),
    [filteredMessages, socialMatchesFilters],
  )

  const summary = {
    total: filteredMessages.length,
    routed: filteredMessages.filter(message => message.status === 'Routed').length,
    converted: filteredMessages.filter(message => message.status === 'ConvertedToTask').length,
  }

  const channelQuickFilters: { value: string; label: string }[] = [
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Phone', label: t('nav.socialPhone', 'Çağrı') },
    { value: 'Instagram', label: 'Instagram' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'X', label: 'X' },
    { value: 'Email', label: t('nav.socialEmail', 'E-posta') },
    { value: 'WebForm', label: t('nav.socialWebForm', 'Web Formu') },
    { value: '', label: t('nav.socialAll', 'Tümü') },
  ]

  const setChannelFilter = (channel: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (channel) nextParams.set('channel', channel)
    else nextParams.delete('channel')
    setSearchParams(nextParams)
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('social.title')}</h1>
            <p className="page-subtitle">{t('social.subtitle')}</p>
          </div>
          <div className="inline-actions">
            <StatusPill className="banner-status-pill">{summary.total} {t('social.total')}</StatusPill>
            <StatusPill className="banner-status-pill">{summary.routed} {t('social.routedSummary')}</StatusPill>
            <StatusPill className="banner-status-pill">{summary.converted} {t('social.convertedSummary')}</StatusPill>
          </div>
        </div>
      </header>

      <section className="section-card">
        <div className="scope-chips" aria-label={t('social.channelFilterLabel', 'Vatandaş talebi kanal filtreleri')}>
          {channelQuickFilters.map(filter => (
            <button
              key={filter.value || 'all'}
              type="button"
              className={`scope-chip ${channelFilter === filter.value ? 'active' : ''}`}
              onClick={() => setChannelFilter(filter.value)}
            >
              {filter.value && <ChannelIcon channel={filter.value} className="size-3.5 shrink-0" />}
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <FilterableTh filterKey="channel" filterValue={socialFilters['channel'] ?? ''} onFilter={setSocialFilter} sortKey="channel" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.channel')}</FilterableTh>
                <FilterableTh filterKey="citizenHandle" filterValue={socialFilters['citizenHandle'] ?? ''} onFilter={setSocialFilter} sortKey="citizenHandle" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.sender')}</FilterableTh>
                <FilterableTh filterKey="category" filterValue={socialFilters['category'] ?? ''} onFilter={setSocialFilter} sortKey="category" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.category')}</FilterableTh>
                <FilterableTh filterKey="assignedDepartmentName" filterValue={socialFilters['assignedDepartmentName'] ?? ''} onFilter={setSocialFilter} sortKey="assignedDepartmentName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.assignedDepartment', 'Sahip Müdürlük')}</FilterableTh>
                <FilterableTh filterKey="status" filterValue={socialFilters['status'] ?? ''} onFilter={setSocialFilter} sortKey="status" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('common.status')}</FilterableTh>
                <th>{t('location.mapSectionTitle', 'Konum')}</th>
                <FilterableTh filterKey="receivedAtUtc" filterValue={socialFilters['receivedAtUtc'] ?? ''} onFilter={setSocialFilter} sortKey="receivedAtUtc" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.date')}</FilterableTh>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {columnFilteredMessages.map(message => (
                <Fragment key={message.socialMessageId}>
                  <tr>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={message.channel} className="size-4 shrink-0" />
                        <span className="font-medium">{getSocialChannelLabel(t, message.channel)}</span>
                      </span>
                    </td>
                    <td className="font-semibold">@{message.citizenHandle}</td>
                    <td>{message.category || t('common.none')}</td>
                    <td>{message.assignedDepartmentName ?? t('common.none')}</td>
                    <td><StatusPill tone={getStatusTone(message.status)}>{getSocialStatusLabel(t, message.status)}</StatusPill></td>
                    <td>
                      {hasLocation(message) ? (
                        <StatusPill tone="success">
                          <MapPin className="size-3.5" />
                          {t('location.mapSectionTitle', 'Konum')}
                        </StatusPill>
                      ) : t('common.none')}
                    </td>
                    <td>{new Date(message.receivedAtUtc).toLocaleString(getLocale(i18n.language))}</td>
                    <td className="actions-cell">
                      {!message.jobId ? (
                        <div className="table-stack">
                          {!message.assignedDepartmentId ? (
                            <>
                              <select
                                aria-label={t('social.departmentSelectionAria', { handle: message.citizenHandle })}
                                className="field-select"
                                value={routeDrafts[message.socialMessageId]?.departmentId ?? ''}
                                onChange={event => {
                                  const departmentId = event.target.value
                                  setRouteDrafts(current => ({
                                    ...current,
                                    [message.socialMessageId]: {
                                      departmentId,
                                    },
                                  }))
                                }}
                              >
                                <option value="">{t('tasks.draftDepartment')}</option>
                                {departments.map(department => (
                                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                                ))}
                              </select>
                              <div className="request-actions">
                                <Button size="sm" type="button" onClick={() => handleRoute(message.socialMessageId)}>{t('social.route')}</Button>
                                <Button size="sm" type="button" variant="destructive" onClick={() => handleDelete(message.socialMessageId)}>{t('social.delete')}</Button>
                              </div>
                            </>
                          ) : (
                            <StatusPill tone="info">{message.assignedDepartmentName ?? t('social.routedSummary')}</StatusPill>
                          )}
                          <div className="request-actions">
                            <input
                              aria-label={t('social.taskTitleAria', { handle: message.citizenHandle })}
                              className="field-input"
                              placeholder={t('social.taskTitlePlaceholder')}
                              type="text"
                              value={taskTitles[message.socialMessageId] ?? ''}
                              onChange={event => setTaskTitles(current => ({ ...current, [message.socialMessageId]: event.target.value }))}
                            />
                            <Button size="sm" type="button" variant="success" onClick={() => handleConvert(message.socialMessageId, message.citizenHandle)}>
                              {t('social.convert')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="request-actions">
                          {message.jobId && (
                            <Button size="sm" type="button" variant="secondary"
                              onClick={() => navigate(`/jobs?scope=all&jobId=${message.jobId}`)}>
                              {t('social.viewJob', 'İşi Görüntüle')}
                            </Button>
                          )}
                          <Button size="sm" type="button" variant="destructive" onClick={() => handleDelete(message.socialMessageId)}>{t('social.delete')}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {hasLocation(message) ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={8}>
                        <section className="grid gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                            <MapPin className="size-4 text-[color:var(--color-primary)]" />
                            {t('location.mapSectionTitle', 'Konum')}
                            <span className="font-semibold normal-case tracking-normal text-slate-500">
                              {message.latitude!.toFixed(6)}, {message.longitude!.toFixed(6)}
                            </span>
                          </div>
                          <iframe
                            src={getLocationMapUrl(message.latitude!, message.longitude!)}
                            className="h-52 w-full rounded-xl border border-slate-200"
                            title={t('location.mapTitle', 'Konum Haritası')}
                          />
                        </section>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">{t('social.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
