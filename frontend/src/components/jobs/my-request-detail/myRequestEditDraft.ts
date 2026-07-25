import type { JobDetail, SocialMessage } from '../../../types/platform'
import { toDateTimePickerValue } from '../../../utils/dateTimePicker'

export interface MyRequestEditDraft {
  title: string
  description: string
  priority: string
  dueDateUtc: string
  neighborhood: string
  street: string
  openAddress: string
  /** Vatandaş talep etiketi (Operator/CRM düzenleme — card #1896 reopen). */
  category: string
}

export function buildMyRequestEditDraft(
  detail: JobDetail,
  citizenSourceMessage?: SocialMessage | null,
): MyRequestEditDraft {
  return {
    title: detail.title,
    description: detail.description ?? '',
    priority: detail.priority,
    dueDateUtc: toDateTimePickerValue(detail.dueDateUtc),
    neighborhood: detail.neighborhood ?? '',
    street: detail.street ?? '',
    openAddress: detail.openAddress ?? '',
    category: citizenSourceMessage?.category?.trim() ?? '',
  }
}
