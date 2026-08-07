/** Ortak Dosya ekle filtresi — yalnız uzantı (#2373 / #dosya-mükerrer).
 * MIME + uzantı birlikte Windows diyalogunda jpg/jpeg mükerrer ve pjp/jfif/dot gibi
 * istenmeyen eşlemeler üretiyordu; accept yalnız uzantı listesi kullanır.
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
] as const

/** `<input type="file" accept=…>` değeri — uzantılar (tekrarsız). */
export const ATTACHMENT_FILE_ACCEPT = ATTACHMENT_ALLOWED_EXTENSIONS.join(',')

export function attachmentFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot).toLocaleLowerCase('tr')
}

export function isAllowedAttachmentFileName(fileName: string): boolean {
  const ext = attachmentFileExtension(fileName)
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}
