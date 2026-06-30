import { useTranslation } from 'react-i18next'
import { RichTextContent } from '../../ui/RichTextContent'
import type { ConfirmDialogState } from '../../ui/confirm-dialog'
import type { JobDetail } from '../../../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../../../utils/localization'
import { richTextToPlainText } from '../../../utils/richText'
import { formatDateTime } from './format'

interface MyRequestTaskDetailsSectionProps {
  detail: JobDetail
  locale: string
  setConfirmDialog: (state: ConfirmDialogState | null) => void
  onDownloadTaskAttachment: (attachmentId: string, fileName: string) => void
}

export function MyRequestTaskDetailsSection({
  detail,
  locale,
  setConfirmDialog,
  onDownloadTaskAttachment,
}: MyRequestTaskDetailsSectionProps) {
  const { t } = useTranslation()

  if (detail.tasks.length === 0) return null

  return (
    <section className="form-card page-stack mb-5">
      <div className="job-detail-section-title mb-1">
        {t('tasks.detail.title', 'Görev Detayları')}
      </div>
      <div className="space-y-3">
        {detail.tasks.map(task => {
          const taskLocation = [task.ownerDepartmentName ?? detail.ownerDepartmentName, detail.createdByDisplayName ?? task.createdByDisplayName]
            .filter(Boolean)
            .join(' / ') || '—'
          const taskType = task.jobSourceType === 'Routine'
            ? t('tasks.type.routine', 'Rutin')
            : task.assigningManagerDisplayName
              ? `${t('tasks.type.assigned', 'Atanmış')} (${task.assigningManagerDisplayName})`
              : t('tasks.type.assigned', 'Atanmış')
          const taskStatus = (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={task.currentStatus === 'Completed'
                ? 'text-emerald-600'
                : (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
                  ? 'text-red-600'
                  : (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress')
                    ? 'text-[#f97316]'
                    : 'text-slate-900'}
              >
                {getTaskStatusLabel(t, task.currentStatus)}
              </span>
              {task.currentStatus === 'Cancelled' && task.revisionReason ? (
                <span className="inline-flex items-center text-red-600">
                  <span>(</span>
                  <button
                    type="button"
                    className="font-semibold hover:text-red-700"
                    onClick={() => setConfirmDialog({ title: t('tasks.detail.cancelNote', 'İptal Notu'), message: task.revisionReason!, hideCancel: true, variant: 'primary', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                  >
                    <span className="underline underline-offset-2">{t('tasks.detail.cancelNote', 'İptal Notu')}</span>
                  </button>
                  <span>)</span>
                </span>
              ) : null}
              {task.currentStatus === 'Completed' && task.notes ? (
                <span className="inline-flex items-center text-emerald-600">
                  <span>(</span>
                  <button
                    type="button"
                    className="font-semibold hover:text-emerald-700"
                    onClick={() => setConfirmDialog({ title: t('tasks.detail.completionNote', 'Tamamlama Notu'), message: richTextToPlainText(task.notes), hideCancel: true, variant: 'primary', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                  >
                    <span className="underline underline-offset-2">{t('tasks.detail.completionNote', 'Tamamlama Notu')}</span>
                  </button>
                  <span>)</span>
                </span>
              ) : null}
            </span>
          )

          return (
            <div key={task.taskId} className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
              <div className="min-w-0 divide-y divide-slate-100">
                {[
                  { label: t('tasks.columns.taskNo', 'Görev No'), value: task.taskNumber != null ? `G-${task.taskNumberYear ?? new Date().getFullYear()}-${task.taskNumber}` : '—' },
                  { label: t('tasks.columns.title', 'Görev Başlığı'), value: task.title },
                  { label: t('tasks.columns.requestLocation', 'Talep Yeri / Oluşturan'), value: taskLocation },
                  { label: t('tasks.columns.owner', 'Görev Sahibi'), value: task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—' },
                  { label: t('tasks.columns.taskType', 'Görev Tipi'), value: taskType },
                  { label: t('tasks.columns.priority', 'Öncelik'), value: getPriorityLabel(t, task.priority) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2 px-3 py-2">
                    <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                    <span className={`min-w-0 break-words text-sm ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                {[
                  { label: t('tasks.columns.status', 'Durum'), value: taskStatus },
                  { label: t('tasks.columns.taskDate', 'Görev Tarihi'), value: formatDateTime(task.createdAtUtc ?? null, locale) },
                  ...(task.currentStatus === 'Completed'
                    ? [{ label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'), value: <span className="text-emerald-600">{formatDateTime(task.completedAtUtc ?? null, locale)}</span> }]
                    : task.currentStatus === 'Cancelled'
                      ? [{ label: t('tasks.columns.cancelledAt', 'İptal Tarihi'), value: <span className="text-red-600">{formatDateTime(task.updatedAtUtc ?? null, locale)}</span> }]
                      : []),
                  { label: t('tasks.columns.dueDate', 'Son Tarih'), value: formatDateTime(task.dueDateUtc, locale) },
                ].map(({ label, value }) => (
                  <div key={label} className={`px-3 py-2${label === t('tasks.columns.dueDate', 'Son Tarih') ? ' border-b border-slate-100' : ''}`}>
                    <div className="text-xs font-semibold text-slate-500">{label}</div>
                    <div className="mt-0.5 break-words text-sm text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
                {detail.status === 'Completed' && task.currentStatus === 'Completed' ? (
                  <div className="grid min-h-full gap-3 lg:grid-cols-2">
                    <div className="min-w-0 border-b border-slate-200 pb-3 lg:border-b-0 lg:border-r lg:pr-3 lg:pb-0">
                      <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('tasks.detail.description', 'Açıklama')}
                      </div>
                      <RichTextContent
                        value={task.description?.trim() ? task.description : detail.description}
                        emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                        className="rich-text-content text-sm leading-6 text-slate-900"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('tasks.detail.attachments', 'Görev Ekleri')}
                      </div>
                      {(task.attachments?.length ?? 0) > 0 ? (
                        <ul className="space-y-1 text-[11px] leading-4">
                          {task.attachments!.map(att => (
                            <li key={att.attachmentId}>
                              <button
                                type="button"
                                className="w-full break-words text-left text-[11px] font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                                onClick={() => onDownloadTaskAttachment(att.attachmentId, att.fileName)}
                              >
                                {att.fileName}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">{t('attachments.taskEmpty', 'Görev için ek/fotoğraf bulunmamaktadır.')}</p>
                      )}
                      <p className="mt-2 text-xs text-orange-500">{t('attachments.taskLockedCompleted', 'Görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('tasks.detail.description', 'Açıklama')}
                    </div>
                    <RichTextContent
                      value={task.description?.trim() ? task.description : detail.description}
                      emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                      className="rich-text-content text-sm leading-6 text-slate-900"
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
