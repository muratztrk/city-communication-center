/** Ortak Dosya ekle filtresi (#2373 / #2848 / #3362).
 * Windows “özel dosyalar”: `accept` yalnız uzantı listesi — MIME karışımı boş veya
 * mükerrer filtre üretebiliyor (#2870 / #3362 reopen). Doğrulama tam izin listesi.
 */
export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.mp4',
] as const

/** Windows özel dosyalar — görsel + doküman uzantıları açık listelenir. */
export const ATTACHMENT_FILE_ACCEPT_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.mp4',
] as const

/** Referans MIME listesi — `accept`'e eklenmez (Windows filtre bozulmasın). */
export const ATTACHMENT_FILE_ACCEPT_MIMES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

/** `<input type="file" accept=…>` — yalnız uzantılar (Windows özel dosyalar). */
export const ATTACHMENT_FILE_ACCEPT = ATTACHMENT_FILE_ACCEPT_EXTENSIONS.join(',')

export function attachmentFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot).toLocaleLowerCase('tr')
}

export function isAllowedAttachmentFileName(fileName: string): boolean {
  const ext = attachmentFileExtension(fileName)
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}
