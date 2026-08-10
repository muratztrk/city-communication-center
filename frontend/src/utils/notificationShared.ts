export const OPEN_NOTIFICATIONS_MODAL_EVENT = 'ccc:open-notifications-modal'
export const OPEN_NOTIFICATION_DETAIL_EVENT = 'ccc:open-notification-detail'

export function localizeNotificationText(value: string): string {
  return value
    .replace(/routine[\s\u00a0]+task[\s\u00a0]+created/giu, 'Rutin görev oluşturuldu')
    .replace(/created[\s\u00a0]+(?:a[\s\u00a0]+)?task/giu, 'Görev oluşturuldu')
    .replace(/task[\s\u00a0]+(?:was[\s\u00a0]+)?created/giu, 'Görev oluşturuldu')
    .replace(/task assigned/gi, 'Görev atandı')
    .replace(/job created/gi, 'Talep oluşturuldu')
    .replace(/job updated/gi, 'Talep güncellendi')
    .replace(/Title updated:/gi, 'Başlık güncellendi:')
    .replace(/\s*—?\s*Created after job owner approval\.?\s*AssignedUser=[0-9a-f-]+/gi, '')
    .replace(/\s*—?\s*Created from job owner user selection\.?\s*AssignedUser=[0-9a-f-]+/gi, '')
    .replace(/\s*—?\s*Created task\b[^—]*/gi, '')
    .replace(/\s*—?\s*Created a task\b[^—]*/gi, '')
    .replace(/\s*—?\s*Task (?:was )?created\b[^—]*/gi, '')
    .replace(/\s*—?\s*Targets=\d+,?\s*OwnerUsers=\d+/gi, '')
    .replace(/\s*—?\s*Status=[^—]*/gi, '')
    .replace(/Assigned to user\s+[0-9a-f-]+/gi, 'Bir personele atandı')
    .replace(/Assigned to:/gi, 'Atanan:')
    .replace(/Unassigned \(pool\)/gi, 'Havuza eklendi')
    .replace(/\s+—\s*$/, '')
    .trim()
}

export function formatNotifDate(value: string | null | undefined, locale: string) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function parseNotificationDetailTarget(url: string): { kind: 'task' | 'job' | 'unsupported'; id?: string; scope?: 'mine' | 'department' } {
  try {
    const parsed = new URL(url, window.location.origin)
    const taskId = parsed.searchParams.get('taskId')
    const jobId = parsed.searchParams.get('jobId')
    const scope: 'mine' | 'department' = /^\/department-tasks(\/|$)/.test(parsed.pathname) ? 'department' : 'mine'
    if (taskId) return { kind: 'task', id: taskId, scope }
    if (jobId) return { kind: 'job', id: jobId }
  } catch {
    const taskMatch = url.match(/[?&]taskId=([^&]+)/)
    const jobMatch = url.match(/[?&]jobId=([^&]+)/)
    const scope: 'mine' | 'department' = /^\/department-tasks(\/|\?|$)/.test(url) ? 'department' : 'mine'
    if (taskMatch) return { kind: 'task', id: decodeURIComponent(taskMatch[1]), scope }
    if (jobMatch) return { kind: 'job', id: decodeURIComponent(jobMatch[1]) }
  }
  return { kind: 'unsupported' }
}
