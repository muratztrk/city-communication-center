import { ClipboardList, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { DateTimePicker } from '../../ui/date-time-picker'
import { Button } from '../../ui/button'
import { RichTextContent } from '../../ui/RichTextContent'
import { RichTextEditor } from '../../ui/RichTextEditor'
import type { MyRequestEditDraft } from './myRequestEditDraft'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { useAuth } from '../../../context/AuthContext'
import { shouldShowJobStatusActorName } from '../../../utils/jobDetails'
import { buildJobProcessSteps, isJobRecoveredFromCancellation } from './buildJobProcessSteps'
import { JobProcessTimeline } from './JobProcessTimeline'
import { buildMyRequestDetailFields } from './myRequestDetailFields'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { formatDateTime } from './format'

export interface DetailDueDateEditState {
  jobId: string
  value: string
  saving: boolean
  mode: 'picking' | 'confirm'
}

interface MyRequestDetailMainCardProps {
  detail: JobDetail
  locale: string
  citizenSourceMessage?: SocialMessage | null
  detailStatusClass: string
  statusContent: ReactNode
  statusLabel?: ReactNode
  statusNoteContent?: ReactNode
  canChangeDueDate: boolean
  detailDueDateEdit: DetailDueDateEditState | null
  onOpenDueDateEdit: () => void
  onCloseDueDateEdit: () => void
  onDueDateChange: (value: string) => void
  onDueDateSave: () => void
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
  statusLabel,
  statusNoteContent,
  canChangeDueDate,
  detailDueDateEdit,
  onOpenDueDateEdit,
  onCloseDueDateEdit,
  onDueDateChange,
  onDueDateSave,
  isEditing = false,
  editDraft,
  onEditDraftChange,
}: MyRequestDetailMainCardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const hideOwnerApproval = user?.role === 'Manager' || user?.role === 'SystemAdmin' || user?.role === 'Reporter'
  const titleLabel = t('jobs.form.title', 'Talep Başlığı')
  const priorityLabel = t('jobs.columns.priority', 'Öncelik')
  const fields = useMemo(
    () => buildMyRequestDetailFields(detail, t, locale, citizenSourceMessage),
    [detail, t, locale, citizenSourceMessage],
  )
  const steps = useMemo(() => buildJobProcessSteps(t, detail, locale, { hideOwnerApproval }), [t, detail, locale, hideOwnerApproval])

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
    </div>
  )

  return (
    <section className={`my-request-detail-main form-card page-stack mb-5${isEditing ? ' my-request-detail-main--editing' : ''}`}>
      <MyRequestSectionHeading icon={ClipboardList} tone="primary">
        {t('jobs.detail.requestInfo', 'Talep Detayları')}
      </MyRequestSectionHeading>
      <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <div className="divide-y divide-slate-100">
            {fields.map(field => (
              <div key={field.label} className="job-detail-field-row job-detail-field-row--request-info">
                <div className="job-detail-field-row__label">{field.label}</div>
                <div className={`job-detail-field-row__value ${field.highlight ? 'text-orange-500' : ''}`}>
                  {isEditing && editDraft && onEditDraftChange && field.label === titleLabel ? (
                    <input
                      className="field-input my-request-detail-edit-control my-request-detail-edit-control--title text-right font-semibold"
                      value={editDraft.title}
                      maxLength={50}
                      onChange={e => onEditDraftChange({ title: e.target.value })}
                      required
                    />
                  ) : isEditing && editDraft && onEditDraftChange && field.label === priorityLabel ? (
                    <select
                      className="field-select my-request-detail-edit-control my-request-detail-edit-control--priority text-right font-semibold"
                      value={editDraft.priority}
                      onChange={e => onEditDraftChange({ priority: e.target.value })}
                    >
                      <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                      <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                      <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                    </select>
                  ) : (
                    field.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <JobProcessTimeline
            steps={steps}
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
        <div className="my-request-detail-description-panel min-w-0 p-4">
          <MyRequestSectionHeading icon={FileText}>
            {t('jobs.form.description', 'Açıklama')}
          </MyRequestSectionHeading>
          {isEditing && editDraft && onEditDraftChange ? (
            <RichTextEditor
              value={editDraft.description}
              onChange={value => onEditDraftChange({ description: value })}
            />
          ) : (
            <RichTextContent
              value={detail.description}
              emptyText={t('common.none')}
              className="rich-text-content text-sm leading-6 text-slate-900"
            />
          )}
        </div>
      </div>
    </section>
  )
}
