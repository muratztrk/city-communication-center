/**
 * DateTimePicker "YYYY-MM-DDTHH:mm" biçiminde NAİF duvar-saati değeriyle çalışır:
 * değeri verbatim gösterir, kaydeden taraf `new Date(value)` ile YEREL saat olarak
 * parse eder. Bu yüzden ISO'dan picker değerine dönüşüm yerel saate çevrilmelidir.
 * `toISOString().slice(0, 16)` (UTC dilimi) kullanmak saati UTC ofseti kadar erken
 * gösterir ve her kayıtta son tarihi geriye kaydırır (card #1677 kök nedenlerinden).
 */
export function toDateTimePickerValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** Talep son tarihi manuel seçiminde en erken şimdi + N saat (card #1819). */
export function earliestDueDatePickerValue(hoursFromNow = 2): string {
  return toDateTimePickerValue(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString())
}

export function clampDueDatePickerValue(value: string, hoursFromNow = 2): string {
  if (!value) return value
  const min = earliestDueDatePickerValue(hoursFromNow)
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
