import { FileText, Info, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RichTextContent } from '../../ui/RichTextContent'
import { AttachmentSection } from '../../ui/AttachmentSection'
import type { JobDetail } from '../../../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../../../utils/localization'
import { formatDateTime, formatDueDateTime } from './format'
import type { JobProcessStep } from './buildJobProcessSteps'
import { JobProcessTimeline } from './JobProcessTimeline'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'

interface MyRequestTaskDetailsSectionProps {
  detail: JobDetail
  locale: string
  onDownloadTaskAttachment: (attachmentId: string, fileName: string) => void
}

function buildTaskProcessSteps(
  t: ReturnType<typeof useTranslation>['t'],
  task: JobDetail['tasks'][number],
  locale: string,
): JobProcessStep[] {
  const isCompleted = task.currentStatus === 'Completed'
  const isCancelled = task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected'
  const dueDateStep: JobProcessStep = {
    id: 'dueDate',
    label: t('tasks.columns.dueDate', 'Son Tarih'),
    displayValue: formatDueDateTime(task.dueDateUtc, locale),
    dateTimeUtc: task.dueDateUtc ?? null,
    state: isCompleted || isCancelled ? 'completed' : 'upcoming',
  }

  if (isCompleted) {
    return [
      {
        id: 'requestDate',
        label: t('tasks.columns.taskDate', 'Görev Tarihi'),
        displayValue: formatDateTime(task.createdAtUtc ?? null, locale),
        dateTimeUtc: task.createdAtUtc ?? null,
        state: 'completed',
      },
      dueDateStep,
      {
        id: 'completionDate',
        label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'),
        displayValue: formatDateTime(task.completedAtUtc ?? null, locale),
        dateTimeUtc: task.completedAtUtc ?? null,
        state: 'terminal-success',
      },
    ]
  }

  if (isCancelled) {
    return [
      {
        id: 'requestDate',
        label: t('tasks.columns.taskDate', 'Görev Tarihi'),
        displayValue: formatDateTime(task.createdAtUtc ?? null, locale),
        dateTimeUtc: task.createdAtUtc ?? null,
        state: 'completed',
      },
      dueDateStep,
      {
        id: 'cancelDate',
        label: t('tasks.columns.cancelledAt', 'İptal Tarihi'),
        displayValue: formatDateTime(task.updatedAtUtc ?? null, locale),
        dateTimeUtc: task.updatedAtUtc ?? null,
        state: 'terminal-danger',
      },
    ]
  }

  return [
    {
      id: 'requestDate',
      label: t('tasks.columns.taskDate', 'Görev Tarihi'),
      displayValue: formatDateTime(task.createdAtUtc ?? null, locale),
      dateTimeUtc: task.createdAtUtc ?? null,
      state: 'completed',
    },
    {
      id: 'status',
      label: t('tasks.columns.status', 'Durum'),
      displayValue: getTaskStatusLabel(t, task.currentStatus),
      dateTimeUtc: null,
      state: 'current',
    },
    dueDateStep,
  ]
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
      <MyRequestSectionHeading icon={ListChecks} tone="primary">
        {t('tasks.detail.title', 'Görev Detayları')}
      </MyRequestSectionHeading>
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
          const statusTone = task.currentStatus === 'Completed'
            ? 'text-emerald-600'
            : (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
              ? 'text-red-600'
              : (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress')
                ? 'text-[#f97316]'
                : 'text-slate-900'
          const processSteps = buildTaskProcessSteps(t, task, locale)
          const dueDateContent = (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{formatDueDateTime(task.dueDateUtc, locale)}</span>
              {task.hasPendingExtraTimeRequest ? (
                <span className="text-xs font-bold text-amber-500">
                  {t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
                </span>
              ) : null}
            </div>
          )

          return (
            <div key={task.taskId} className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={Info}>
                  {t('tasks.detail.taskInfo', 'Görev Bilgileri')}
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields divide-y divide-slate-100">
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
                    <div key={label} className="job-detail-field-row job-detail-field-row--request-info">
                      <div className="job-detail-field-row__label">{label}</div>
                      <div className={`job-detail-field-row__value ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                {/* Görev Detayları Süreç kolonu Taleplerim/Görevlerim timeline tasarımını kullanır (card #1527). */}
                <JobProcessTimeline
                  steps={processSteps}
                  locale={locale}
                  statusContent={(
                    <span className={`inline ${statusTone}`}>
                      {getTaskStatusLabel(t, task.currentStatus)}
                    </span>
                  )}
                  dueDateContent={dueDateContent}
                />
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
                    // Görevin RevisionReason'ı yoksa talebin CancelReason'ına düş (card #1530).
                    value={task.revisionReason?.trim() || detail.cancelReason}
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
