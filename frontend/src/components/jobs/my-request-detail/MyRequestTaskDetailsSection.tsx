import { ArrowRight, FileImage, FileText, Info, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { RichTextContent } from '../../ui/RichTextContent'
import type { JobDetail } from '../../../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../../../utils/localization'
import { formatDateTime, formatDueDateTime, getStatusChangeTextClass } from './format'
import type { JobProcessStep } from './buildJobProcessSteps'
import { JobProcessTimeline } from './JobProcessTimeline'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { StackedFieldValue } from './StackedFieldValue'
import { lowercaseFileExtension } from '../../../utils/fileNameDisplay'

interface MyRequestTaskDetailsSectionProps {
  detail: JobDetail
  locale: string
  onDownloadTaskAttachment: (attachmentId: string, fileName: string) => void
  hidePlainDescription?: boolean
  // Taleplerim'de standart kullanıcı için Adres Bilgileri, Süreç'in önünde ikinci kolon
  // olarak buraya taşınır; Süreç, Açıklama'nın yerine kayar (card #1549).
  addressColumnContent?: ReactNode
}

function getInlineAttachmentIcon(fileName: string) {
  return /\.(?:jpe?g|png)$/i.test(fileName) ? FileImage : FileText
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
  hidePlainDescription = false,
  addressColumnContent,
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
          const taskLocationDepartment = task.ownerDepartmentName ?? detail.ownerDepartmentName
          const taskLocationCreator = detail.createdByDisplayName ?? task.createdByDisplayName
          const taskNoText = task.taskNumber != null ? `G-${task.taskNumberYear ?? new Date().getFullYear()}-${task.taskNumber}` : '—'
          const taskTypeBadge = task.jobSourceType === 'Routine'
            ? t('tasks.type.routine', 'Rutin')
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

          const hasTerminalNote = (detail.status === 'Completed' && task.currentStatus === 'Completed')
            || ((detail.status === 'Cancelled' || detail.status === 'Rejected') && (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected'))
          const showDescriptionCard = !hidePlainDescription || hasTerminalNote
          const gridColsClass = addressColumnContent
            ? (showDescriptionCard
                ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)]'
                : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]')
            : (showDescriptionCard
                ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]'
                : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]')

          return (
            <div key={task.taskId} className={`grid gap-4 ${gridColsClass}`}>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={Info} className="w-full">
                  <span className="grid min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                    <span className="min-w-0">{t('tasks.detail.taskInfo', 'Görev Bilgileri')}</span>
                    <span className="ml-auto flex max-w-full flex-col items-end justify-center gap-1 text-right">
                      <span className="max-w-full break-words text-xs font-semibold leading-tight text-slate-500">{taskNoText}</span>
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">{taskTypeBadge}</span>
                    </span>
                  </span>
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields divide-y divide-slate-100">
                  {[
                    {
                      // Talep yeri (birim) üst, oluşturan personel alt satırda (card #1544).
                      label: t('tasks.columns.requestLocation', 'Talep Yeri / Oluşturan'),
                      value: <StackedFieldValue top={taskLocationDepartment} bottom={taskLocationCreator} />,
                    },
                    { label: t('tasks.columns.owner', 'Görevi Yapan'), value: task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—' },
                    ...(task.jobSourceType !== 'Routine'
                      ? [{ label: t('tasks.detail.assigningManager', 'Görevi Atayan Yönetici'), value: task.assigningManagerDisplayName ?? '—' }]
                      : []),
                    ...(task.jobSourceType !== 'Routine' && (task.statusChangeHistory?.length ?? 0) > 0
                      ? [{
                          label: t('tasks.detail.statusChangeHistory', 'Durum Değişikliği'),
                          value: (() => {
                            const history = task.statusChangeHistory!
                            const firstChange = history[history.length - 1]
                            const lastChange = history[0]
                            const firstStatus = firstChange.fromStatus ?? firstChange.toStatus
                            return (
                              <div className="flex w-full items-start justify-end gap-2 text-right">
                                <div className="min-w-0">
                                  <div className={`font-normal ${getStatusChangeTextClass(firstStatus)}`}>{getTaskStatusLabel(t, firstStatus)}</div>
                                  <div className="text-[10px] font-normal text-slate-500">{formatDateTime(firstChange.changedAtUtc, locale)}</div>
                                </div>
                                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                <div className="min-w-0">
                                  <div className={`font-normal ${getStatusChangeTextClass(lastChange.toStatus)}`}>{getTaskStatusLabel(t, lastChange.toStatus)}</div>
                                  <div className="text-[10px] font-normal text-slate-500">{formatDateTime(lastChange.changedAtUtc, locale)}</div>
                                </div>
                              </div>
                            )
                          })(),
                        }]
                      : []),
                    ...(task.jobSourceType === 'Routine'
                      ? [{ label: t('tasks.columns.priority', 'Öncelik'), value: getPriorityLabel(t, task.priority) }]
                      : []),
                    // Görevlerim'in kendi görünümünde rutin görevler için ayrı, her zaman görünen bir
                    // Ekler/Fotoğraflar kartı var; bu paylaşılan "Görev Detayları" bileşeninde öyle bir
                    // kart yok — rutin dışlaması burada uygulanmaz, aksi halde tamamlanmış/iptal rutin
                    // görevin ekleri hiçbir yerde görünmez olurdu (codex review, card #1548 regresyonu).
                    ...((task.currentStatus === 'Completed' || task.currentStatus === 'Cancelled')
                      ? [{
                          label: t('attachments.taskSectionTitle', 'Görev Ekleri'),
                          value: (task.attachments?.length ?? 0) === 0 ? '—' : (
                            <div className="flex flex-col items-end gap-1">
                              {task.attachments!.map(attachment => {
                                const AttachmentIcon = getInlineAttachmentIcon(attachment.fileName)
                                return (
                                  <button
                                    key={attachment.attachmentId}
                                    type="button"
                                    className="inline-flex max-w-full items-center gap-1 text-emerald-700 hover:text-emerald-800"
                                    onClick={() => onDownloadTaskAttachment(attachment.attachmentId, attachment.fileName)}
                                  >
                                    <AttachmentIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{lowercaseFileExtension(attachment.fileName)}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ),
                        }]
                      : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="job-detail-field-row job-detail-field-row--request-info">
                      <div className="job-detail-field-row__label">{label}</div>
                      <div className={`job-detail-field-row__value ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {addressColumnContent && (
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                  {addressColumnContent}
                </div>
              )}
              {showDescriptionCard && <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={FileText}>
                  {detail.status === 'Completed' && task.currentStatus === 'Completed'
                    ? t('tasks.detail.completionNoteTitle', 'Görev Tamamlama Notu')
                    : (detail.status === 'Cancelled' || detail.status === 'Rejected') && (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
                      ? t('tasks.detail.cancelNoteTitle', 'Görev İptal Notu')
                      : t('tasks.detail.description', 'Açıklama')}
                </MyRequestSectionHeading>
                {detail.status === 'Completed' && task.currentStatus === 'Completed' ? (
                  // Görev Ekleri artık yalnız Görev Bilgileri kartında gösterilir; burada tekrar
                  // edilmez (card #1548).
                  <RichTextContent
                    value={task.notes}
                    emptyText={t('tasks.detail.noCompletionNote', 'Tamamlama notu girilmemiş')}
                    className="rich-text-content text-sm leading-6 text-slate-900"
                  />
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
              </div>}
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                {/* Terminal not/açıklama kartı Süreç'in önünde kalır (cards #1574/#1578). */}
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
            </div>
          )
        })}
      </div>
    </section>
  )
}
