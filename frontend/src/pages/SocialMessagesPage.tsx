import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import type { Department, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel, getSocialStatusLabel } from '../utils/localization'

function getStatusTone(status: string) {
  if (status === 'ConvertedToTask') return 'success' as const
  if (status === 'Routed') return 'info' as const
  if (status === 'Closed') return 'neutral' as const
  return 'warning' as const
}

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routeDrafts, setRouteDrafts] = useState<Record<string, { departmentId: string }>>({})
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({})

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
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : t('common.error'))
    }
  }

  const handleConvert = async (socialMessageId: string, citizenHandle: string) => {
    const title = taskTitles[socialMessageId]?.trim() || t('social.defaultTaskTitle', { handle: citizenHandle })

    try {
      await api.convertSocialMessageToTask(socialMessageId, {
        title,
        description: t('social.defaultTaskDescription', { handle: citizenHandle }),
        priority: 'Normal',
        dueDateUtc: null,
      })
      await reload()
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : t('common.error'))
    }
  }

  const summary = {
    total: messages.length,
    routed: messages.filter(message => message.status === 'Routed').length,
    converted: messages.filter(message => message.status === 'ConvertedToTask').length,
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack">
      <header className="page-header-row">
        <div className="space-y-2">
          <h1 className="page-title">{t('social.title')}</h1>
          <p className="page-subtitle">{t('social.subtitle')}</p>
        </div>
        <div className="inline-actions">
          <StatusPill>{summary.total} {t('social.total')}</StatusPill>
          <StatusPill tone="info">{summary.routed} {t('social.routedSummary')}</StatusPill>
          <StatusPill tone="success">{summary.converted} {t('social.convertedSummary')}</StatusPill>
        </div>
      </header>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('social.channel')}</th>
                <th>{t('social.sender')}</th>
                <th>{t('social.category')}</th>
                <th>{t('common.status')}</th>
                <th>{t('social.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map(message => (
                <tr key={message.socialMessageId}>
                  <td>{getSocialChannelLabel(t, message.channel)}</td>
                  <td className="font-semibold">@{message.citizenHandle}</td>
                  <td>{message.category || t('common.none')}</td>
                  <td><StatusPill tone={getStatusTone(message.status)}>{getSocialStatusLabel(t, message.status)}</StatusPill></td>
                  <td>{new Date(message.receivedAtUtc).toLocaleString(getLocale(i18n.language))}</td>
                  <td>
                    {!message.taskId ? (
                      <div className="table-stack">
                        <select
                          aria-label={t('social.departmentSelectionAria', { handle: message.citizenHandle })}
                          className="field-select"
                          value={routeDrafts[message.socialMessageId]?.departmentId ?? message.assignedDepartmentId ?? ''}
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
                        <div className="inline-actions">
                          <Button size="sm" type="button" onClick={() => handleRoute(message.socialMessageId)}>{t('social.route')}</Button>
                        </div>
                        <div className="inline-actions">
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
                      <StatusPill tone="success">{t('social.converted')}</StatusPill>
                    )}
                  </td>
                </tr>
              ))}
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">{t('social.empty')}</div>
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
