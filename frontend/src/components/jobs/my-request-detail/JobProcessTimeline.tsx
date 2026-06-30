import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { JobProcessStep } from './buildJobProcessSteps'

interface JobProcessTimelineProps {
  steps: JobProcessStep[]
  statusContent?: ReactNode
  dueDateContent?: ReactNode
}

function StepIndicator({ state }: { state: JobProcessStep['state'] }) {
  if (state === 'completed' || state === 'terminal-success') {
    return (
      <span className="job-process-timeline__indicator job-process-timeline__indicator--completed">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
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
      <div className="job-detail-section-title mb-3">
        {t('jobs.detail.processTitle', 'SÜREÇ')}
      </div>
      <ol className="job-process-timeline__list">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
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
                {!isLast && <span className="job-process-timeline__line" aria-hidden="true" />}
              </div>
              <div className="job-process-timeline__content min-w-0 pb-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
