import { Landmark } from 'lucide-react'

interface ReporterDepartmentNameProps {
  name: string | null | undefined
  isReporter: boolean
  className?: string
}

export function ReporterDepartmentName({ name, isReporter, className = '' }: ReporterDepartmentNameProps) {
  const text = name ?? '—'

  if (!isReporter) {
    return <div className={`truncate font-semibold text-slate-700 ${className}`.trim()}>{text}</div>
  }

  return (
    <div className={`flex min-w-0 max-w-full items-center justify-center gap-1 font-bold text-orange-500 ${className}`.trim()}>
      <Landmark className="size-3.5 shrink-0 text-orange-500" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </div>
  )
}
