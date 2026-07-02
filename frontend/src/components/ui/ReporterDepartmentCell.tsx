import { ReporterDepartmentName } from './ReporterDepartmentName'
import { reporterCreatorTextClass } from '../../utils/reporterHighlight'

interface ReporterDepartmentCellProps {
  departmentName: string | null | undefined
  creatorName: string | null | undefined
  isReporter: boolean
  align?: 'center' | 'start'
  className?: string
}

export function ReporterDepartmentCell({
  departmentName,
  creatorName,
  isReporter,
  align = 'start',
  className = '',
}: ReporterDepartmentCellProps) {
  return (
    <div className={`${align === 'center' ? 'text-center' : ''} ${className}`.trim()}>
      <ReporterDepartmentName name={departmentName} isReporter={isReporter} />
      <div className={`truncate ${reporterCreatorTextClass(isReporter)}`}>{creatorName ?? '—'}</div>
    </div>
  )
}
