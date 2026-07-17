import { Check, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { JobProcessStep } from './buildJobProcessSteps'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { splitDateTimeParts } from './format'

function getLineClass(
  step: JobProcessStep,
  nextStep: JobProcessStep | undefined,
  recoveredFromCancellation: boolean,
): string {
  if (!nextStep) return ''
  const stepDone = step.state === 'completed' || step.state === 'terminal-success'
  const nextDone = nextStep.state === 'completed' || nextStep.state === 'terminal-success'
  const nextIsActiveCurrent = nextStep.state === 'current' || nextStep.state === 'pending'

  if (stepDone && nextDone) return 'job-process-timeline__line--completed'
  if (stepDone && nextStep.state === 'pending') {
    return 'job-process-timeline__line--to-pending'
  }
  if (stepDone && nextStep.state === 'current') {
    return recoveredFromCancellation
      ? 'job-process-timeline__line--to-current-from-danger'
      : 'job-process-timeline__line--to-current'
  }
  if (stepDone && nextStep.state === 'terminal-success') {
    return recoveredFromCancellation
      ? 'job-process-timeline__line--to-success-from-danger'
      : 'job-process-timeline__line--completed'
  }
  if (stepDone && nextStep.state === 'terminal-danger') return 'job-process-timeline__line--to-danger'
  if (step.state === 'terminal-danger' && nextIsActiveCurrent && recoveredFromCancellation) {
    return nextStep.state === 'pending'
      ? 'job-process-timeline__line--to-pending-from-danger'
      : 'job-process-timeline__line--to-current-from-danger'
  }
  if (step.state === 'terminal-danger' && nextStep.state === 'terminal-success' && recoveredFromCancellation) {
    return 'job-process-timeline__line--to-success-from-danger'
  }
  if (step.state === 'terminal-danger') return 'job-process-timeline__line--from-danger'
  if (step.state === 'pending') return 'job-process-timeline__line--from-pending'
  if (step.state === 'current') return 'job-process-timeline__line--from-current'
  return 'job-process-timeline__line--upcoming'
}

function getStepLabelClass(state: JobProcessStep['state']): string {
  if (state === 'completed' || state === 'terminal-success') return 'text-emerald-600'
  if (state === 'pending') return 'text-sky-500'
  if (state === 'current') return 'text-orange-500'
  if (state === 'terminal-danger') return 'text-red-600'
  return 'text-slate-400'
}

/** Tarihsiz "Onay Bekleyen" değerleri biraz daha küçük (card #1640). */
function isPendingApprovalDisplayValue(displayValue: string): boolean {
  const normalized = displayValue.trim().toLocaleLowerCase('tr')
  return normalized === 'onay bekleyen' || normalized === 'pending approval'
}

interface JobProcessTimelineProps {
  steps: JobProcessStep[]
  locale: string
  recoveredFromCancellation?: boolean
  statusContent?: ReactNode
  statusActorName?: string | null
  statusNoteContent?: ReactNode
  dueDateContent?: ReactNode
}

function ProcessStepDateValue({
  step,
  locale,
  metaTone,
  metaContent,
  className,
}: {
  step: JobProcessStep
  locale: string
  metaTone: string
  metaContent?: ReactNode
  className: string
}) {
  const parts = step.dateTimeUtc ? splitDateTimeParts(step.dateTimeUtc, locale) : null

  if (!parts) {
    return (
      <div className={className}>
        <span className="inline">
          {step.displayValue}
          {step.displayMeta ? (
            <span className={`ml-1 align-baseline text-xs font-semibold ${metaTone}`}>
              ({step.displayMeta})
            </span>
          ) : null}
          {metaContent}
        </span>
      </div>
    )
  }

  return (
    <div className={className}>
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span>{parts.date}</span>
        <span className="job-process-timeline__datetime-bullet" aria-hidden="true" />
        <span>{parts.time}</span>
        {step.displayMeta ? (
          <span className={`align-baseline text-xs font-semibold ${metaTone}`}>
            ({step.displayMeta})
          </span>
        ) : null}
        {metaContent}
      </span>
    </div>
  )
}

function StepIndicator({ state, shouldPulse }: { state: JobProcessStep['state']; shouldPulse: boolean }) {
  if (state === 'completed' || state === 'terminal-success') {
    return (
      <span className={`job-process-timeline__indicator job-process-timeline__indicator--completed${shouldPulse ? ' job-process-timeline__indicator--pulse-success' : ''}`}>
        <Check className="size-2.5" strokeWidth={2.75} aria-hidden="true" />
      </span>
    )
  }
  if (state === 'terminal-danger') {
    return <span className={`job-process-timeline__indicator job-process-timeline__indicator--danger${shouldPulse ? ' job-process-timeline__indicator--pulse-danger' : ''}`} aria-hidden="true" />
  }
  if (state === 'current') {
    return <span className="job-process-timeline__indicator job-process-timeline__indicator--current" aria-hidden="true" />
  }
  if (state === 'pending') {
    return <span className="job-process-timeline__indicator job-process-timeline__indicator--pending" aria-hidden="true" />
  }
  return <span className="job-process-timeline__indicator job-process-timeline__indicator--upcoming" aria-hidden="true" />
}

export function JobProcessTimeline({
  steps,
  locale,
  recoveredFromCancellation = false,
  statusContent,
  statusActorName,
  statusNoteContent,
  dueDateContent,
}: JobProcessTimelineProps) {
  const { t } = useTranslation()
  const pulseIndex = (() => {
    const pendingIndex = steps.findIndex(step => step.state === 'pending')
    if (pendingIndex >= 0) return pendingIndex
    const currentIndex = steps.findIndex(step => step.state === 'current')
    if (currentIndex >= 0) return currentIndex
    const terminalIndex = steps.findIndex(step => step.state === 'terminal-success' || step.state === 'terminal-danger')
    if (terminalIndex >= 0) return terminalIndex
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      if (steps[index].state === 'completed') return index
    }
    return -1
  })()

  return (
    <div className="job-process-timeline">
      <MyRequestSectionHeading icon={Clock}>
        {t('jobs.detail.processTitle', 'Süreç')}
      </MyRequestSectionHeading>
      <ol className="job-process-timeline__list">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const nextStep = isLast ? undefined : steps[index + 1]
          const lineClass = getLineClass(step, nextStep, recoveredFromCancellation)
          const showTerminalDateMeta = (step.id === 'completionDate' || step.id === 'cancelDate')
            && statusContent
            && !(step.id === 'cancelDate' && recoveredFromCancellation)
          const valueTone = step.id === 'completionDate'
            ? 'text-emerald-600'
            : step.id === 'cancelDate'
                ? 'text-red-600'
                : step.state === 'pending'
                  ? 'text-sky-500'
                  : step.state === 'current'
                    ? 'text-[#f97316]'
                    : step.state === 'upcoming'
                      ? 'text-slate-400'
                      : 'text-slate-900'
          const displayMetaTone = step.state === 'pending'
            ? 'text-sky-500'
            : step.state === 'current'
              ? 'text-[#f97316]'
              : 'text-emerald-600'

          return (
            <li key={step.id} className="job-process-timeline__item">
              <div className="job-process-timeline__track">
                <StepIndicator state={step.state} shouldPulse={index === pulseIndex} />
                {!isLast && <span className={`job-process-timeline__line ${lineClass}`} aria-hidden="true" />}
              </div>
              <div className="job-process-timeline__content min-w-0 pb-4">
                <div className={`text-xs font-semibold tracking-wide ${getStepLabelClass(step.state)}`}>
                  {showTerminalDateMeta ? (
                    <span className="inline">
                      {step.label}
                      {statusActorName ? ` (${statusActorName})` : ''}
                    </span>
                  ) : (
                    step.label
                  )}
                </div>
                {step.id === 'status' && statusContent ? (
                  <div className={`job-process-timeline__step-value mt-0.5 text-xs font-semibold ${valueTone}${isPendingApprovalDisplayValue(step.displayValue) ? ' job-process-timeline__step-value--pending-approval' : ''}`}>
                    {statusContent}
                  </div>
                ) : showTerminalDateMeta ? (
                  <ProcessStepDateValue
                    step={step}
                    locale={locale}
                    metaTone={displayMetaTone}
                    metaContent={statusNoteContent}
                    className={`job-process-timeline__step-value mt-0.5 text-sm font-semibold ${valueTone}`}
                  />
                ) : step.id === 'dueDate' && dueDateContent ? (
                  <div className="mt-0.5">{dueDateContent}</div>
                ) : (
                  <ProcessStepDateValue
                    step={step}
                    locale={locale}
                    metaTone={displayMetaTone}
                    className={`job-process-timeline__step-value mt-0.5 font-semibold ${valueTone} ${isPendingApprovalDisplayValue(step.displayValue) ? 'job-process-timeline__step-value--pending-approval text-xs' : 'text-sm'}`}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
