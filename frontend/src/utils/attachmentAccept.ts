/** Ortak Dosya ekle filtresi (#2373 / #2848).
 * MIME + uzantı birlikte (Windows filtre). `image/jpeg`, `video/quicktime`, `video/webm`, `video/3gpp`,
 * `video/mp4` (m4v alias) ve `application/msword` accept'te yok.
 * MIME ile aynı uzantıyı accept'e tekrar yazma — Windows özel dosyalarda mükerrer satır (#2870 / #2848 reopen).
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
] as const

/** Accept uzantıları — Windows özel dosyalar listesi (#2870 reopen geri getir). */
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
  '.mov',
  '.webm',
] as const

/** MIME listesi — `video/mp4` Windows özel dosyalarda m4v satırı üretir (#2848). */
export const ATTACHMENT_FILE_ACCEPT_MIMES = [
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

/** `<input type="file" accept=…>` — MIME + ek uzantılar (mükerrer yok). */
export const ATTACHMENT_FILE_ACCEPT = [
  ...ATTACHMENT_FILE_ACCEPT_MIMES,
  ...ATTACHMENT_FILE_ACCEPT_EXTENSIONS,
].join(',')

export function attachmentFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot).toLocaleLowerCase('tr')
}

export function isAllowedAttachmentFileName(fileName: string): boolean {
  const ext = attachmentFileExtension(fileName)
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}
