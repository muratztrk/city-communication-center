import { ClipboardList, FileText, Info } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { DateTimePicker } from '../../ui/date-time-picker'
import { Button } from '../../ui/button'
import { RichTextContent } from '../../ui/RichTextContent'
import { RichTextEditor } from '../../ui/RichTextEditor'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import type { MyRequestEditDraft } from './myRequestEditDraft'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { useAuth } from '../../../context/AuthContext'
import { shouldShowJobStatusActorName } from '../../../utils/jobDetails'
import { buildJobProcessSteps, isJobRecoveredFromCancellation } from './buildJobProcessSteps'
import { JobProcessTimeline } from './JobProcessTimeline'
import { buildMyRequestDetailFields } from './myRequestDetailFields'
import type { MyRequestDetailField } from './myRequestDetailFields'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { formatDateTime } from './format'
import { getPriorityLabel } from '../../../utils/localization'
import { prioritySelectOptions } from '../../../utils/formDropdownOptions'
import { JobProjectValue } from '../../../utils/jobProjectDisplay'
import { normalizeTitleCaseField } from '../../../utils/textNormalization'
import { formatJobDisplayNumberText } from '../../../utils/requestNumberText'
import { formatCitizenRequestNumber, isCitizenRequestJob } from '../../../utils/citizenRequests'

export interface DetailDueDateEditState {
  jobId: string
  value: string
  saving: boolean
  mode: 'picking' | 'confirm'
}

export interface JobExtraTimeReviewState {
  jobId: string
  taskId: string
  proposedDueDateUtc: string | null
  loading: boolean
  saving: boolean
}

interface MyRequestInfoFieldsListProps {
  fields: MyRequestDetailField[]
  detail: JobDetail
  t: TFunction
  isEditing?: boolean
  editDraft?: MyRequestEditDraft
  onEditDraftChange?: (patch: Partial<MyRequestEditDraft>) => void
  priorityOptions?: { value: string; label: string }[]
}

export function MyRequestInfoFieldsList({
  fields,
  detail,
  t,
  isEditing = false,
  editDraft,
  onEditDraftChange,
  priorityOptions,
}: MyRequestInfoFieldsListProps) {
  const priorityLabel = t('jobs.columns.priority', 'Öncelik')
  return (
    <div className="my-request-detail-fields divide-y divide-slate-100">
      {fields.map(field => (
        <div key={field.label} className="job-detail-field-row job-detail-field-row--request-info">
          <div className="job-detail-field-row__label">{field.label}</div>
          <div className={`job-detail-field-row__value ${field.highlight ? 'text-orange-500' : ''}`}>
            {isEditing && editDraft && onEditDraftChange && field.label === priorityLabel ? (
              <SingleSelectDropdown
                openUp
                className="my-request-detail-edit-control my-request-detail-edit-control--priority ml-auto"
                triggerClassName="font-semibold"
                menuScrollClassName="dropdown-menu-scroll--compact"
                options={priorityOptions ?? []}
                value={editDraft.priority}
                onChange={priority => onEditDraftChange({ priority })}
                placeholder={t('jobs.form.priority', 'Öncelik')}
              />
            ) : (
              field.value
            )}
          </div>
        </div>
      ))}
      {!isEditing && (
        <div className="job-detail-field-row job-detail-field-row--request-info">
          <div className="job-detail-field-row__label">{t('jobs.detail.priorityProject', 'Öncelik / Proje mi?')}</div>
          <div className="job-detail-field-row__value">
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>{getPriorityLabel(t, detail.priority)}</span>
              <span className="job-process-timeline__datetime-bullet" aria-hidden="true" />
              <JobProjectValue job={detail} t={t} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface MyRequestDetailMainCardProps {
  detail: JobDetail
  locale: string
  citizenSourceMessage?: SocialMessage | null
  detailStatusClass: string
  statusContent: ReactNode
  sectionTitle?: ReactNode
  statusLabel?: ReactNode
  statusNoteContent?: ReactNode
  requestNumberSuffix?: ReactNode
  extraFields?: MyRequestDetailField[]
  // Görevlerim popup'ında (İlgili Talep Detayları) atanan kişi Görev Bilgileri'nde zaten
  // gösterildiği için tekrar edilmez (card #1446).
  includeAssigneeField?: boolean
  // Görevlerim popup'ında (İlgili Talep Detayları) talep başlığı metni başlık alanından
  // kaldırılıp Talep Bilgileri listesine taşınır (card #1444).
  hideTitleText?: boolean
  // Görevlerim popup'ında (İlgili Talep Detayları) orta sütuna Talep Bilgileri yerine
  // Adres Bilgileri gösterilir (card #1449).
  middleColumnOverride?: ReactNode
  // Görevlerim popup'ında (İlgili Talep Detayları) sol sütunda açıklama yerine Talep Bilgileri
  // gösterilir (card #1444 tekrarı).
  leftColumnBelowHeading?: ReactNode
  canChangeDueDate: boolean
  detailDueDateEdit: DetailDueDateEditState | null
  onOpenDueDateEdit: () => void
  onCloseDueDateEdit: () => void
  onDueDateChange: (value: string) => void
  onDueDateSave: () => void
  // Talep detayında ek süre talebini yöneticinin karara bağlaması için (card #1404).
  jobExtraTimeReview?: JobExtraTimeReviewState | null
  onOpenExtraTimeReview?: () => void
  onExtraTimeDecision?: (decision: 'approve' | 'reject') => void
  onCancelExtraTimeReview?: () => void
  isEditing?: boolean
  editDraft?: MyRequestEditDraft
  onEditDraftChange?: (patch: Partial<MyRequestEditDraft>) => void
}

export function MyRequestDetailMainCard({
  detail,
  locale,
  citizenSourceMessage,
  detailStatusClass,
  statusContent,
  sectionTitle,
  statusLabel,
  statusNoteContent,
  requestNumberSuffix,
  extraFields,
  includeAssigneeField = true,
  hideTitleText = false,
  middleColumnOverride,
  leftColumnBelowHeading,
  canChangeDueDate,
  detailDueDateEdit,
  onOpenDueDateEdit,
  onCloseDueDateEdit,
  onDueDateChange,
  onDueDateSave,
  jobExtraTimeReview,
  onOpenExtraTimeReview,
  onExtraTimeDecision,
  onCancelExtraTimeReview,
  isEditing = false,
  editDraft,
  onEditDraftChange,
}: MyRequestDetailMainCardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const hideOwnerApproval = isManagerLike || user?.role === 'Reporter'
  // Talep detayında bekleyen ek süre isteği yönetici tarafından karara bağlanabilir (card #1404).
  const hasPendingExtraTime = detail.tasks.some(task => task.hasPendingExtraTimeRequest)
  const canReviewExtraTime = isManagerLike && hasPendingExtraTime && Boolean(onOpenExtraTimeReview)
  const isExtraTimeReviewOpen = jobExtraTimeReview?.jobId === detail.jobId
  const titleLabel = t('jobs.form.title', 'Talep Başlığı')
  const priorityLabel = t('jobs.columns.priority', 'Öncelik')
  const requestNoLabel = t('jobs.columns.requestNo', 'Talep No')
  const citizenRequestNoLabel = t('jobs.detail.citizenRequestNo', 'Vatandaş Talep No')
  const projectLabel = t('jobs.form.isProject', 'Proje mi')
  const fields = useMemo(
    () => buildMyRequestDetailFields(detail, t, locale, citizenSourceMessage, requestNumberSuffix, extraFields, includeAssigneeField),
    [detail, t, locale, citizenSourceMessage, requestNumberSuffix, extraFields, includeAssigneeField],
  )
  const visibleFields = fields.filter(field => {
    if (field.label === titleLabel) return false
    if ([requestNoLabel, citizenRequestNoLabel].includes(field.label)) return false
    if (!isEditing && [priorityLabel, projectLabel].includes(field.label)) return false
    return true
  })
  const steps = useMemo(() => buildJobProcessSteps(t, detail, locale, { hideOwnerApproval }), [t, detail, locale, hideOwnerApproval])
  const priorityOptions = useMemo(() => prioritySelectOptions(t), [t])
  const requestTypeText = detail.requestType === 'ExternalUnit'
    ? t('jobs.requestType.external', 'Birim Dışı')
    : t('jobs.requestType.internal', 'Birim İçi')
  const requestNumberText = isCitizenRequestJob(detail)
    ? formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: detail.createdAtUtc }, locale)
    : formatJobDisplayNumberText(detail, locale)

  const dueDateContent = isEditing && editDraft && onEditDraftChange ? (
    <div className="my-request-detail-edit-due-date">
      <DateTimePicker
        value={editDraft.dueDateUtc}
        onChange={value => onEditDraftChange({ dueDateUtc: value })}
        placeholder={t('jobs.form.dueDate', 'Son Tarih')}
        forceUp
      />
    </div>
  ) : detailDueDateEdit?.jobId === detail.jobId ? (
    <div className="mt-1 flex flex-col gap-1.5">
      <DateTimePicker
        value={detailDueDateEdit.value}
        onChange={onDueDateChange}
        placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
        className={detailDueDateEdit.mode === 'picking' ? 'h-0 overflow-visible [&>button:first-of-type]:sr-only [&>button:nth-of-type(2)]:hidden' : 'hidden'}
        forceUp
        autoOpen
        onClose={detailDueDateEdit.mode === 'picking' ? onCloseDueDateEdit : undefined}
      />
      {detailDueDateEdit.mode === 'confirm' && (
        <div className="flex max-w-[18rem] flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
          <span className="text-xs font-semibold text-slate-900">
            {detailDueDateEdit.value
              ? formatDateTime(new Date(detailDueDateEdit.value).toISOString(), locale)
              : t('common.none')}
          </span>
          <div className="inline-actions justify-start gap-1.5">
            <Button type="button" size="sm" variant="success" disabled={detailDueDateEdit.saving} onClick={onDueDateSave}>
              {detailDueDateEdit.saving ? t('common.loading') : t('common.save', 'Kaydet')}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={detailDueDateEdit.saving} onClick={onCloseDueDateEdit}>
              {t('common.cancel', 'Vazgeç')}
            </Button>
          </div>
        </div>
      )}
    </div>
  ) : isExtraTimeReviewOpen && jobExtraTimeReview && onExtraTimeDecision ? (
    // Ek süre talebini gör → Onayla/Reddet/Vazgeç (Görevler ve Birime Gelen detayıyla aynı akış, card #1404).
    <div className="mt-1 flex max-w-[20rem] flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
      <span className="text-xs font-semibold text-slate-900">
        {jobExtraTimeReview.loading
          ? t('common.loading')
          : jobExtraTimeReview.proposedDueDateUtc
            ? `${t('tasks.actions.extraTimeRequest', 'Ek süre iste')}: ${formatDateTime(jobExtraTimeReview.proposedDueDateUtc, locale)}`
            : t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
      </span>
      <div className="inline-actions justify-start gap-1.5">
        <Button type="button" size="sm" variant="success" disabled={jobExtraTimeReview.saving || jobExtraTimeReview.loading} onClick={() => onExtraTimeDecision('approve')}>
          {jobExtraTimeReview.saving ? t('common.loading') : t('common.approve', 'Onayla')}
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={jobExtraTimeReview.saving || jobExtraTimeReview.loading} onClick={() => onExtraTimeDecision('reject')}>
          {t('common.reject', 'Reddet')}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={jobExtraTimeReview.saving} onClick={() => onCancelExtraTimeReview?.()}>
          {t('common.cancel', 'Vazgeç')}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-900">
        {steps.find(step => step.id === 'dueDate')?.displayValue}
      </span>
      {canChangeDueDate && (
        <button
          type="button"
          className="text-xs font-bold text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
          onClick={onOpenDueDateEdit}
        >
          {t('common.change', 'Değiştir')}
        </button>
      )}
      {canReviewExtraTime && (
        <button
          type="button"
          className="text-xs font-bold text-amber-600 underline underline-offset-2 hover:text-amber-700"
          onClick={() => onOpenExtraTimeReview?.()}
        >
          {t('tasks.actions.viewExtraTimeRequest', 'Ek süre talebini gör')}
        </button>
      )}
    </div>
  )

  return (
    <section className={`my-request-detail-main form-card page-stack mb-5${isEditing ? ' my-request-detail-main--editing' : ''}`}>
      <MyRequestSectionHeading icon={ClipboardList} tone="primary">
        {sectionTitle ?? t('jobs.detail.requestInfo', 'Talep Detayları')}
      </MyRequestSectionHeading>
      <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          {!hideTitleText ? (
            <MyRequestSectionHeading icon={FileText} className="my-request-title-heading">
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                <span className="min-w-0">
                  {isEditing && editDraft && onEditDraftChange ? (
                    <textarea
                      className="field-textarea my-request-title-heading-edit__textarea font-semibold"
                      value={editDraft.title}
                      maxLength={50}
                      rows={Math.min(3, Math.max(1, Math.ceil((editDraft.title.length || 1) / 32)))}
                      onChange={e => onEditDraftChange({ title: e.target.value })}
                      required
                    />
                  ) : (
                    normalizeTitleCaseField(detail.title)
                  )}
                </span>
                <span className="ml-auto flex max-w-full flex-col items-end justify-center gap-1 text-right">
                  <span className="max-w-full break-words text-xs font-semibold leading-tight text-slate-500">{requestNumberText}</span>
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">{requestTypeText}</span>
                </span>
              </span>
            </MyRequestSectionHeading>
          ) : null}
          {leftColumnBelowHeading ?? (
            isEditing && editDraft && onEditDraftChange ? (
              <RichTextEditor
                value={editDraft.description}
                onChange={value => onEditDraftChange({ description: value })}
                minHeight="min-h-40"
              />
            ) : (
              <RichTextContent
                value={detail.description}
                emptyText={t('common.none')}
                className="rich-text-content mt-1.5 text-xs leading-5 text-slate-900"
              />
            )
          )}
        </div>
        <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          {middleColumnOverride ?? (
            <>
              <MyRequestSectionHeading icon={Info}>
                {t('jobs.detail.requestInfoFields', 'Talep Bilgileri')}
              </MyRequestSectionHeading>
              <MyRequestInfoFieldsList
                fields={visibleFields}
                detail={detail}
                t={t}
                isEditing={isEditing}
                editDraft={editDraft}
                onEditDraftChange={onEditDraftChange}
                priorityOptions={priorityOptions}
              />
            </>
          )}
        </div>
        <div className="min-w-0 p-4">
          <JobProcessTimeline
            steps={steps}
            locale={locale}
            recoveredFromCancellation={isJobRecoveredFromCancellation(detail)}
            statusContent={(
              <span className={`inline ${detailStatusClass}`}>
                {statusLabel ?? statusContent}
              </span>
            )}
            statusActorName={shouldShowJobStatusActorName(detail) ? detail.statusActorDisplayName : null}
            statusNoteContent={statusNoteContent}
            dueDateContent={dueDateContent}
          />
        </div>
      </div>
    </section>
  )
}
