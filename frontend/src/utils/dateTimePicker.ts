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

/** Seçilen picker değeri bugünün yerel takvim gününde mi? */
export function isSameLocalCalendarDayAsNow(pickerValue: string | null | undefined): boolean {
  if (!pickerValue || pickerValue.length < 10) return true
  const selectedDay = pickerValue.slice(0, 10)
  const todayDay = toLocalDateKey(new Date().toISOString())
  return selectedDay === todayDay
}

/** Yerel duvar saati `HH:mm` (card #2515 reopen). */
export function currentLocalTimeHm(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** Farklı takvim günü: mevcut saat; aynı gün: now+N saat (#2515). */
function dueDateMinForPickerDay(pickerValue: string, hoursFromNow = 2): string {
  if (pickerValue.length >= 10 && !isSameLocalCalendarDayAsNow(pickerValue)) {
    return `${pickerValue.slice(0, 10)}T${currentLocalTimeHm()}`
  }
  return toDateTimePickerValue(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString())
}

/** İki naif picker değerinden daha geç olanı. */
export function laterPickerValue(a: string, b?: string | null): string {
  if (!b) return a
  return a >= b ? a : b
}

/**
 * Hafta sonu SLA durduruluyorsa (Ayarlar), Cmt/Paz oluştururken Son Tarih en erken
 * sonraki Pazartesi mesai + varsayılan SLA saat (#2706).
 */
export function weekendSlaDueDateFloor(
  excludeWeekends: boolean,
  mondayStartHm = '08:30',
  slaHours = 48,
  now = new Date(),
): string | null {
  if (!excludeWeekends) return null
  const day = now.getDay()
  if (day !== 0 && day !== 6) return null
  const daysUntilMonday = day === 6 ? 2 : 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday)
  const hm = /^\d{2}:\d{2}/.test(mondayStartHm) ? mondayStartHm.slice(0, 5) : '08:30'
  const [hour = 8, minute = 30] = hm.split(':').map(Number)
  monday.setHours(hour, minute, 0, 0)
  let remaining = Math.max(slaHours, 0)
  const cursor = new Date(monday)
  while (remaining > 0) {
    cursor.setHours(cursor.getHours() + 1)
    const weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  const y = cursor.getFullYear()
  const m = String(cursor.getMonth() + 1).padStart(2, '0')
  const d = String(cursor.getDate()).padStart(2, '0')
  const hh = String(cursor.getHours()).padStart(2, '0')
  const mm = String(cursor.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

export function earliestDueDatePickerValue(hoursFromNow = 2, pickerValue?: string | null, absoluteMin?: string | null): string {
  const base = pickerValue && pickerValue.length >= 10
    ? dueDateMinForPickerDay(pickerValue, hoursFromNow)
    : dueDateMinForPickerDay(toLocalDateKey(new Date().toISOString()), hoursFromNow)
  return laterPickerValue(base, absoluteMin)
}

export function clampDueDatePickerValue(value: string, hoursFromNow = 2, absoluteMin?: string | null): string {
  if (!value) return value
  const min = earliestDueDatePickerValue(hoursFromNow, value, absoluteMin)
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
  duePickerValue?: string | null,
  absoluteMin?: string | null,
): string {
  let base: string
  if (duePickerValue && duePickerValue.length >= 10 && !isSameLocalCalendarDayAsNow(duePickerValue)) {
    base = `${duePickerValue.slice(0, 10)}T${currentLocalTimeHm()}`
  } else if (startPickerValue && startPickerValue.length >= 16) {
    const startMs = new Date(startPickerValue).getTime()
    base = !Number.isNaN(startMs)
      ? toDateTimePickerValue(new Date(startMs + hoursAfter * 60 * 60 * 1000).toISOString())
      : earliestDueDatePickerValue(hoursAfter, duePickerValue)
  } else {
    base = earliestDueDatePickerValue(hoursAfter, duePickerValue)
  }
  return laterPickerValue(base, absoluteMin)
}

export function clampDueDateRelativeToStart(
  value: string,
  startPickerValue: string | null | undefined,
  hoursAfter = 2,
  absoluteMin?: string | null,
): string {
  if (!value) return value
  const min = earliestDueDateRelativeToStart(startPickerValue, hoursAfter, value, absoluteMin)
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
