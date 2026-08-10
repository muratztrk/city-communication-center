import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  ClipboardList,
  FolderKanban,
  ListChecks,
  MessageSquareMore,
  Send,
  SquareKanban,
  Tag,
  Users,
} from 'lucide-react'

/** Pie chart başlık ikonları — sol menü ile hizalı (card #2535 / #2536). */
export function getDashboardChartTitleIcon(titleKey: string): LucideIcon | null {
  if (titleKey === 'dashboard.charts.myRequests') return ClipboardList
  if (titleKey === 'dashboard.charts.myTasks') return ListChecks
  if (titleKey.startsWith('dashboard.charts.staff')) return Users
  if (titleKey === 'dashboard.charts.incomingRequests') return FolderKanban
  if (titleKey === 'dashboard.charts.outgoingRequests') return ArrowUpRight
  if (titleKey === 'dashboard.citizenChannels.title') return Send
  if (titleKey === 'dashboard.charts.departmentTasks') return SquareKanban
  if (titleKey === 'dashboard.charts.citizenRequests') return MessageSquareMore
  if (titleKey === 'dashboard.charts.requestTags') return Tag
  if (titleKey.startsWith('dashboard.charts.externalRequest')) return ClipboardList
  if (
    titleKey.includes('neighborhood')
    || titleKey.includes('citizenDepartment')
  ) {
    return ClipboardList
  }
  return null
}
