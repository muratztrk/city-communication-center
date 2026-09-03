/** Ortak Dosya ekle filtresi (#2373 / #2848 / #3362).
 * Windows “özel dosyalar” MIME + uzantı birlikte; MIME ile çakışan uzantıyı accept'e tekrar yazma.
 * Doğrulama tam izin listesi (`ATTACHMENT_ALLOWED_EXTENSIONS`).
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

/** MIME listesinde olmayan uzantılar — MIME ile çakışan .png/.pdf/.docx vb. yok (#2870). */
export const ATTACHMENT_FILE_ACCEPT_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.xls',
  '.ppt',
  '.mp4',
] as const

/** MIME listesi — `video/mp4` Windows özel dosyalarda m4v satırı üretir (#2848). */
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
