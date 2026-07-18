import { Check, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { JobProcessStep } from './buildJobProcessSteps'
import { MyRequestSectionHeading } from './MyRequestSectionHeading'
import { isPendingApprovalText, splitDateTimeParts } from './format'

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
    const pendingApprovalText = isPendingApprovalText(step.displayValue)
    return (
      <div className={className}>
        <span className={pendingApprovalText ? 'job-process-timeline__pending-approval-text inline' : 'inline'}>
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
          // Durum: Onay Bekleyen + Yapılmakta mavi (#1643/#1651); Son Tarihi Geçmiş turuncu (#1644).
          // Onay adımları Onay Bekleyen → mavi pending (card #1645).
          const isStatusStep = step.id === 'status'
          const statusUseBlue = isStatusStep && step.state === 'pending'
          const statusUseOrange = isStatusStep && step.state === 'current'
          const valueTone = statusUseBlue
            ? 'text-sky-500'
            : statusUseOrange
              ? 'text-[#f97316]'
              : step.id === 'completionDate'
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
          const displayMetaTone = statusUseBlue
            ? 'text-sky-500'
            : statusUseOrange
              ? 'text-[#f97316]'
              : step.state === 'pending'
                ? 'text-sky-500'
                : step.state === 'current'
                  ? 'text-[#f97316]'
                  : 'text-emerald-600'
          const labelClass = statusUseBlue
            ? 'text-sky-500'
            : statusUseOrange
              ? 'text-orange-500'
              : getStepLabelClass(step.state)
          const indicatorState = statusUseBlue
            ? 'pending'
            : statusUseOrange
              ? 'current'
              : step.state

          return (
            <li key={step.id} className="job-process-timeline__item">
              <div className="job-process-timeline__track">
                <StepIndicator state={indicatorState} shouldPulse={index === pulseIndex} />
                {!isLast && <span className={`job-process-timeline__line ${lineClass}`} aria-hidden="true" />}
              </div>
              <div className="job-process-timeline__content min-w-0 pb-4">
                <div className={`text-xs font-semibold tracking-wide ${labelClass}`}>
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
                  <div className={`job-process-timeline__step-value mt-0.5 text-xs font-semibold ${valueTone}${statusUseBlue ? ' [&_*]:!text-sky-500' : statusUseOrange ? ' [&_*]:!text-[#f97316]' : ''}`}>
                    {typeof statusContent === 'string' && isPendingApprovalText(statusContent) ? (
                      <span className="job-process-timeline__pending-approval-text">{statusContent}</span>
                    ) : (
                      statusContent
                    )}
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
                    className={`job-process-timeline__step-value mt-0.5 text-sm font-semibold ${valueTone}`}
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
