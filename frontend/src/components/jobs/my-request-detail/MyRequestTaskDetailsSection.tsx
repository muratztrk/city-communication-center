import { FileText, Info, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { RichTextContent } from '../../ui/RichTextContent'
import { SimpleImageAttachmentIcon } from '../../ui/SimpleImageAttachmentIcon'
import type { JobDetail } from '../../../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../../../utils/localization'
import { formatDateTime, formatDueDateTime } from './format'
import type { JobProcessStep } from './buildJobProcessSteps'
import { JobProcessTimeline } from './JobProcessTimeline'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { StackedFieldValue } from './StackedFieldValue'
import { StatusChangeTransition } from './StatusChangeTransition'
import { lowercaseFileExtension } from '../../../utils/fileNameDisplay'
import { richTextToPlainText } from '../../../utils/richText'

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
  return /\.(?:jpe?g|png)$/i.test(fileName) ? SimpleImageAttachmentIcon : FileText
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
      // Son Tarihi Geçmiş / Yapılmakta → turuncu; Bekleyen → mavi (cards #1643/#1644/#1645).
      state: (task.dueDateUtc != null && new Date(task.dueDateUtc).getTime() < Date.now())
        || task.currentStatus === 'Assigned'
        || task.currentStatus === 'InProgress'
        ? 'current'
        : 'pending',
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

          const isCompletedTask = task.currentStatus === 'Completed'
          const isCancelledTask = task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected'
          const showDescriptionCard = !hidePlainDescription
          // Açıklama yokken Görev Bilgileri + Süreç eşit kolonlarda; kartlar düşeyde eşit
          // yükseklikte (items-stretch) ve başlıklar üstte hizalı (cards #1634/#1635).
          const gridColsClass = addressColumnContent
            ? (showDescriptionCard
                ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)]'
                : 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)]')
            : (showDescriptionCard
                ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]'
                : 'lg:grid-cols-2')

          return (
            <div key={task.taskId} className={`grid items-stretch gap-4 ${gridColsClass}`}>
              <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={Info} className="w-full">
                  <span className="grid min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1">
                    <span className="min-w-0 leading-tight">{t('tasks.detail.taskInfo', 'Görev Bilgileri')}</span>
                    <span className="ml-auto flex max-w-full flex-col items-end justify-start gap-1 text-right">
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
                    ...(task.jobSourceType !== 'Routine'
                      ? [{ label: t('tasks.detail.assigningManager', 'Görevi Atayan Yönetici'), value: task.assigningManagerDisplayName ?? '—' }]
                      : []),
                    { label: t('tasks.columns.owner', 'Görevi Yapan'), value: task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—' },
                    ...(isCompletedTask
                      ? [{
                          label: t('tasks.actions.completionNote', 'Tamamlama Notu'),
                          value: richTextToPlainText(task.notes) || '—',
                          // Etiket + değer yeşil (card #1638).
                          tone: 'completion' as const,
                        }]
                      : isCancelledTask
                        ? [{
                            label: t('tasks.detail.cancelNote', 'İptal Notu'),
                            value: task.revisionReason?.trim() || detail.cancelReason?.trim() || '—',
                            // Etiket + değer kırmızı (card #1638).
                            tone: 'cancel' as const,
                          }]
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
                              <StatusChangeTransition
                                fromStatus={firstStatus}
                                toStatus={lastChange.toStatus}
                                fromAtUtc={firstChange.changedAtUtc}
                                toAtUtc={lastChange.changedAtUtc}
                                locale={locale}
                              />
                            )
                          })(),
                        }]
                      : []),
                    ...(task.jobSourceType !== 'Routine' && (task.statusChangeHistory?.length ?? 0) > 0
                      ? [{
                          label: t('tasks.detail.statusChangeReason', 'Durum Değişikliği Nedeni'),
                          value: task.statusChangeHistory![0].reason ?? '—',
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
                  ].map((row) => {
                    const tone = 'tone' in row ? row.tone : undefined
                    return (
                    <div key={row.label} className="job-detail-field-row job-detail-field-row--request-info">
                      <div className={`job-detail-field-row__label ${tone === 'cancel' ? 'text-red-600' : tone === 'completion' ? 'text-emerald-600' : ''}`}>{row.label}</div>
                      <div className={`job-detail-field-row__value ${tone === 'cancel' ? 'text-red-600' : tone === 'completion' ? 'text-emerald-600' : typeof row.value === 'string' ? 'text-slate-900' : ''}`}>{row.value}</div>
                    </div>
                    )
                  })}
                </div>
              </div>
              {addressColumnContent && (
                <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
                  {addressColumnContent}
                </div>
              )}
              {showDescriptionCard && <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
                <MyRequestSectionHeading icon={FileText}>
                  {t('tasks.detail.description', 'Açıklama')}
                </MyRequestSectionHeading>
                <RichTextContent
                  value={task.description?.trim() ? task.description : detail.description}
                  emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                  className="rich-text-content text-sm leading-6 text-slate-900"
                />
              </div>}
              <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
                {/* Açıklama gösterilen yüzeylerde Süreç'in önünde kalır; terminal not Görev Bilgileri'ndedir. */}
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
