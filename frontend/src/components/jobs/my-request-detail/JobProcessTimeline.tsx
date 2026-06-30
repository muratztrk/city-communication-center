import { Check, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { JobProcessStep } from './buildJobProcessSteps'
import { DETAIL_ICON_PROPS } from './detailIcons'

function getLineClass(step: JobProcessStep, nextStep: JobProcessStep | undefined): string {
  if (!nextStep) return ''
  const stepDone = step.state === 'completed' || step.state === 'terminal-success'
  const nextDone = nextStep.state === 'completed' || nextStep.state === 'terminal-success'

  if (stepDone && nextDone) return 'job-process-timeline__line--completed'
  if (stepDone && nextStep.state === 'current') return 'job-process-timeline__line--to-current'
  if (step.state === 'current') return 'job-process-timeline__line--upcoming'
  return 'job-process-timeline__line--upcoming'
}

function getStepLabelClass(state: JobProcessStep['state']): string {
  if (state === 'completed' || state === 'terminal-success') return 'text-emerald-600'
  if (state === 'current') return 'text-orange-500'
  if (state === 'terminal-danger') return 'text-red-600'
  return 'text-slate-400'
}

interface JobProcessTimelineProps {
  steps: JobProcessStep[]
  statusContent?: ReactNode
  dueDateContent?: ReactNode
}

function StepIndicator({ state }: { state: JobProcessStep['state'] }) {
  if (state === 'completed' || state === 'terminal-success') {
    return (
      <span className="job-process-timeline__indicator job-process-timeline__indicator--completed">
        <Check className="size-3" strokeWidth={2.25} aria-hidden="true" />
      </span>
    )
  }
  if (state === 'terminal-danger') {
    return <span className="job-process-timeline__indicator job-process-timeline__indicator--danger" aria-hidden="true" />
  }
  if (state === 'current') {
    return <span className="job-process-timeline__indicator job-process-timeline__indicator--current" aria-hidden="true" />
  }
  return <span className="job-process-timeline__indicator job-process-timeline__indicator--upcoming" aria-hidden="true" />
}

export function JobProcessTimeline({ steps, statusContent, dueDateContent }: JobProcessTimelineProps) {
  const { t } = useTranslation()

  return (
    <div className="job-process-timeline">
      <div className="job-detail-section-title job-detail-section-title--muted mb-3">
        <Clock {...DETAIL_ICON_PROPS} />
        {t('jobs.detail.processTitle', 'SÜREÇ')}
      </div>
      <ol className="job-process-timeline__list">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const nextStep = isLast ? undefined : steps[index + 1]
          const lineClass = getLineClass(step, nextStep)
          const valueTone = step.id === 'completionDate'
            ? 'text-emerald-600'
            : step.id === 'cancelDate'
              ? 'text-red-600'
              : step.id === 'status' && (step.state === 'terminal-success' || step.state === 'current')
                ? step.state === 'terminal-success' ? 'text-emerald-600' : 'text-[#f97316]'
                : step.id === 'status' && step.state === 'terminal-danger'
                  ? 'text-red-600'
                  : 'text-slate-900'

          return (
            <li key={step.id} className="job-process-timeline__item">
              <div className="job-process-timeline__track">
                <StepIndicator state={step.state} />
                {!isLast && <span className={`job-process-timeline__line ${lineClass}`} aria-hidden="true" />}
              </div>
              <div className="job-process-timeline__content min-w-0 pb-4">
                <div className={`text-xs font-semibold uppercase tracking-wide ${getStepLabelClass(step.state)}`}>
                  {step.label}
                </div>
                {step.id === 'status' && statusContent ? (
                  <div className={`mt-0.5 text-sm font-semibold ${valueTone}`}>{statusContent}</div>
                ) : step.id === 'dueDate' && dueDateContent ? (
                  <div className="mt-0.5">{dueDateContent}</div>
                ) : (
                  <div className={`mt-0.5 text-sm font-semibold ${valueTone}`}>{step.displayValue}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
