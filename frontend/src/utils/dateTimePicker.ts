/**
 * DateTimePicker "YYYY-MM-DDTHH:mm" biçiminde NAİF duvar-saati değeriyle çalışır:
 * değeri verbatim gösterir, kaydeden taraf `new Date(value)` ile YEREL saat olarak
 * parse eder. Bu yüzden ISO'dan picker değerine dönüşüm yerel saate çevrilmelidir.
 * `toISOString().slice(0, 16)` (UTC dilimi) kullanmak saati UTC ofseti kadar erken
 * gösterir ve her kayıtta son tarihi geriye kaydırır (card #1677 kök nedenlerinden).
 */
export function toDateTimePickerValue(value: string | null | undefined): string {
  if (!value) return ''
  // Zaten naif picker değeriyse olduğu gibi bırak (dashboard dönem / query param).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** Yerel duvar-saati picker değerini API'nin beklediği ISO UTC'ye çevirir (#r542 / dönem TZ). */
export function toApiDateParam(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}

/** Filtre gün karşılaştırması için yerel takvim günü `YYYY-MM-DD` (#r542). */
export function toLocalDateKey(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Manuel tarih seçiminde en erken şimdi + N saat (card #1819; N=0 → şu an). */
export function earliestDueDatePickerValue(hoursFromNow = 2): string {
  return toDateTimePickerValue(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString())
}

export function clampDueDatePickerValue(value: string, hoursFromNow = 2): string {
  if (!value) return value
  const min = earliestDueDatePickerValue(hoursFromNow)
  return value < min ? min : value
}

/** Talep Oluştur Başlangıç: en erken şu an (card #6a6f6301). */
export function earliestStartDatePickerValue(): string {
  return earliestDueDatePickerValue(0)
}

export function clampStartDatePickerValue(value: string): string {
  if (!value) return value
  const min = earliestStartDatePickerValue()
  return value < min ? min : value
}

/**
 * Son Tarih min: başlangıç seçiliyse başlangıç + N saat, değilse şimdi + N saat
 * (cards #1819 / #6a6f6301).
 */
export function earliestDueDateRelativeToStart(
  startPickerValue: string | null | undefined,
  hoursAfter = 2,
): string {
  if (startPickerValue && startPickerValue.length >= 16) {
    const startMs = new Date(startPickerValue).getTime()
    if (!Number.isNaN(startMs)) {
      return toDateTimePickerValue(new Date(startMs + hoursAfter * 60 * 60 * 1000).toISOString())
    }
  }
  return earliestDueDatePickerValue(hoursAfter)
}

export function clampDueDateRelativeToStart(
  value: string,
  startPickerValue: string | null | undefined,
  hoursAfter = 2,
): string {
  if (!value) return value
  const min = earliestDueDateRelativeToStart(startPickerValue, hoursAfter)
  return value < min ? min : value
}

/** Onay bekleyen taleplerde "Son Tarihi Geçmiş" yalnız takvim günü değişince (card #1819). */
export function isDueDatePastCalendarDay(dueDateUtc: string | null | undefined): boolean {
  if (!dueDateUtc) return false
  const due = new Date(dueDateUtc)
  if (Number.isNaN(due.getTime())) return false
  const now = new Date()
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return dueDay < today
}

export function isPendingApprovalJobStatus(status: string): boolean {
  return status === 'PendingOwnerApproval' || status === 'PendingExternalApproval' || status === 'PendingApproval'
}

export function isJobDueDateOverdue(job: { status: string; dueDateUtc: string | null | undefined }): boolean {
  if (!job.dueDateUtc) return false
  if (isPendingApprovalJobStatus(job.status)) return isDueDatePastCalendarDay(job.dueDateUtc)
  return new Date(job.dueDateUtc).getTime() < Date.now()
}
