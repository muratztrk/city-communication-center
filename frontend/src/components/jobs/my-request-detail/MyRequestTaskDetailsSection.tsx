import { Clock, FileText, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RichTextContent } from '../../ui/RichTextContent'
import { AttachmentSection } from '../../ui/AttachmentSection'
import type { JobDetail } from '../../../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../../../utils/localization'
import { formatDateTime } from './format'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'

interface MyRequestTaskDetailsSectionProps {
  detail: JobDetail
  locale: string
  onDownloadTaskAttachment: (attachmentId: string, fileName: string) => void
}

export function MyRequestTaskDetailsSection({
  detail,
  locale,
  onDownloadTaskAttachment,
}: MyRequestTaskDetailsSectionProps) {
  const { t } = useTranslation()

  if (detail.tasks.length === 0) return null

  return (
    <section className="my-request-task-details form-card page-stack mb-5">
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
          )

          return (
            <div key={task.taskId} className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={Info}>
                  {t('tasks.detail.taskInfo', 'Görev Bilgileri')}
                </MyRequestSectionHeading>
                <div className="divide-y divide-slate-100">
                  {[
                    { label: t('tasks.columns.taskNo', 'Görev No'), value: task.taskNumber != null ? `G-${task.taskNumberYear ?? new Date().getFullYear()}-${task.taskNumber}` : '—' },
                    { label: t('tasks.columns.title', 'Görev Başlığı'), value: task.title },
                    { label: t('tasks.columns.requestLocation', 'Talep Yeri / Oluşturan'), value: taskLocation },
                    { label: t('tasks.columns.owner', 'Görev Sahibi'), value: task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—' },
                    { label: t('tasks.columns.taskType', 'Görev Tipi'), value: taskType },
                    ...(task.jobSourceType === 'Routine'
                      ? [{ label: t('tasks.columns.priority', 'Öncelik'), value: getPriorityLabel(t, task.priority) }]
                      : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2 py-2">
                      <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                      <span className={`min-w-0 break-words text-sm ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={Clock}>
                  {t('jobs.detail.processTitle', 'Süreç')}
                </MyRequestSectionHeading>
                <div className="divide-y divide-slate-100">
                  {[
                    { label: t('tasks.columns.status', 'Durum'), value: taskStatus },
                    { label: t('tasks.columns.taskDate', 'Görev Tarihi'), value: formatDateTime(task.createdAtUtc ?? null, locale) },
                    ...(task.currentStatus === 'Completed'
                      ? [{ label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'), value: <span className="text-emerald-600">{formatDateTime(task.completedAtUtc ?? null, locale)}</span> }]
                      : task.currentStatus === 'Cancelled'
                        ? [{ label: t('tasks.columns.cancelledAt', 'İptal Tarihi'), value: <span className="text-red-600">{formatDateTime(task.updatedAtUtc ?? null, locale)}</span> }]
                        : []),
                    {
                      label: t('tasks.columns.dueDate', 'Son Tarih'),
                      // Yöneticide bekleyen ek süre talebi talep detayında da görünür (card #1385).
                      value: (
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>{formatDateTime(task.dueDateUtc, locale)}</span>
                          {task.hasPendingExtraTimeRequest ? (
                            <span className="text-xs font-bold text-amber-500">
                              {t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="py-2">
                      <div className="text-xs font-semibold text-slate-500">{label}</div>
                      <div className="mt-0.5 break-words text-sm text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={FileText}>
                  {detail.status === 'Completed' && task.currentStatus === 'Completed'
                    ? t('tasks.detail.completionNoteTitle', 'Görev Tamamlama Notu')
                    : (detail.status === 'Cancelled' || detail.status === 'Rejected') && (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
                      ? t('tasks.detail.cancelNoteTitle', 'Görev İptal Notu')
                      : t('tasks.detail.description', 'Açıklama')}
                </MyRequestSectionHeading>
                {detail.status === 'Completed' && task.currentStatus === 'Completed' ? (
                  <div className="grid min-h-full gap-3 lg:grid-cols-2">
                    <div className="min-w-0 border-b border-slate-200 pb-3 lg:border-b-0 lg:border-r lg:pr-3 lg:pb-0">
                      <RichTextContent
                        value={task.notes}
                        emptyText={t('tasks.detail.noCompletionNote', 'Tamamlama notu girilmemiş')}
                        className="rich-text-content text-sm leading-6 text-slate-900"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('tasks.detail.attachments', 'Görev Ekleri')}
                      </div>
                      {(task.attachments?.length ?? 0) > 0 ? (
                        <AttachmentSection
                          attachments={task.attachments!}
                          readOnly
                          compact
                          displayMode="list"
                          onDownload={onDownloadTaskAttachment}
                        />
                      ) : (
                        <p className="text-sm text-slate-400">{t('attachments.taskEmpty', 'Görev için ek/fotoğraf bulunmamaktadır.')}</p>
                      )}
                      <p className="mt-2 text-xs text-orange-500">{t('attachments.taskLockedCompleted', 'Görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}</p>
                    </div>
                  </div>
                ) : (detail.status === 'Cancelled' || detail.status === 'Rejected') && (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected') ? (
                  <RichTextContent
                    value={task.revisionReason}
                    emptyText={t('tasks.detail.noCancelNote', 'İptal notu girilmemiş')}
                    className="rich-text-content text-sm leading-6 text-slate-900"
                  />
                ) : (
                  <RichTextContent
                    value={task.description?.trim() ? task.description : detail.description}
                    emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                    className="rich-text-content text-sm leading-6 text-slate-900"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
