/** Ortak Dosya ekle filtresi (#2373 reopen).
 * Accept yalnız MIME — Windows’ta uzantı+MIME birlikte jpg/jpeg mükerrer üretiyordu;
 * uzantı-only macOS’ta “Tüm dosyalar” görünmesine yol açabiliyordu.
 * Seçim sonrası uzantı doğrulaması `isAllowedAttachmentFileName` ile devam eder.
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
  '.mov',
  '.webm',
  '.3gp',
] as const

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
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
] as const

/** `<input type="file" accept=…>` — MIME listesi (uzantı accept’e eklenmez). */
export const ATTACHMENT_FILE_ACCEPT = ATTACHMENT_FILE_ACCEPT_MIMES.join(',')

export function attachmentFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot).toLocaleLowerCase('tr')
}

export function isAllowedAttachmentFileName(fileName: string): boolean {
  const ext = attachmentFileExtension(fileName)
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}
