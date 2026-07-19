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
