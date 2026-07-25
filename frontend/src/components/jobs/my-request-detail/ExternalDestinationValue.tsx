import type { JobDetail } from '../../../types/platform'
import { formatJobDestinationsWithAssignees, getJobDestinationStacks } from '../../../utils/jobDetails'
import { EmptyCell } from '../../ui/EmptyCell'
import { FramedDepartmentStack } from './FramedDepartmentStack'

/** Talep Yapılan Birim / Gittiği Yer — dış birimde çerçeve + altında atanan (card #r449). */
export function ExternalDestinationValue({
  detail,
  framed,
}: {
  detail: JobDetail
  framed: boolean
}) {
  if (!framed) {
    return <>{formatJobDestinationsWithAssignees(detail, false, false)}</>
  }

  const stacks = getJobDestinationStacks(detail)
  if (stacks.length === 0) return <EmptyCell />

  return (
    <div className="flex flex-col items-end gap-2">
      {stacks.map(stack => (
        <FramedDepartmentStack
          key={stack.departmentName}
          departmentName={stack.departmentName}
          secondary={stack.assignees.length > 0 ? stack.assignees.join(', ') : null}
          enlarge
        />
      ))}
    </div>
  )
}
