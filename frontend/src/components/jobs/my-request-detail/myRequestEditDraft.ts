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
  /** Çağrı kanalı düzenlemede ad/telefon (#6a6d903e). */
  citizenName: string
  citizenPhone: string
}

function digitsOnlyPhone(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits.slice(0, 10)
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
    citizenName: detail.citizenName?.trim()
      || citizenSourceMessage?.citizenName?.trim()
      || '',
    citizenPhone: digitsOnlyPhone(detail.citizenPhone || citizenSourceMessage?.citizenPhone),
  }
}
