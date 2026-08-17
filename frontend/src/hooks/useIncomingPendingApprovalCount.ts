import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { getActiveDepartmentId } from '../api/http'
import { getLocale } from '../utils/localization'
import { countIncomingPendingApprovalForNav } from '../utils/incomingRequestGrid'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import type { AuthUser } from '../types/platform'

export function useIncomingPendingApprovalCount(user: AuthUser | null, language: string) {
  const activeDeptId = getActiveDepartmentId()
  const citizenOnly = hasCitizenRequestManagerRole(user)
  const locale = getLocale(language)

  return useQuery({
    queryKey: queryKeys.incoming.pendingApprovalCount(activeDeptId, user?.userId, citizenOnly),
    queryFn: async () => {
      const [tasks, jobs, socialMessages] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('my-department'),
        api.getSocialMessages(),
      ])
      return countIncomingPendingApprovalForNav(tasks, jobs, activeDeptId, socialMessages, locale, citizenOnly)
    },
    enabled: Boolean(user?.userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
