/** Ortak Dosya ekle filtresi (#2373 / #2848).
 * MIME + uzantı birlikte (Windows filtre). `image/jpeg`, `video/quicktime`, `video/webm`, `video/3gpp`
 * ve `application/msword` accept’te yok — özel dosyalar listesinde jpe/jfif/mov/webm/3gpp/dot vb. çıkar.
 * Seçim sonrası `.jpeg` / `.mov` / `.webm` doğrulaması `isAllowedAttachmentFileName` ile devam eder.
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

/** Accept attribute uzantıları — MIME yerine uzantı (jpeg/mov/webm/dot alias önlemi). */
export const ATTACHMENT_FILE_ACCEPT_EXTENSIONS = [
  '.jpg',
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

export const ATTACHMENT_FILE_ACCEPT_MIMES = [
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
] as const

/** `<input type="file" accept=…>` — MIME + uzantı (Windows + macOS). */
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
