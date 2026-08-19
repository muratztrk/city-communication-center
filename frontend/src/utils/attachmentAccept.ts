/** Ortak Dosya ekle filtresi (#2373 / #2848 / #2870).
 * Windows “özel dosyalar” MIME + uzantı karışınca ya mükerrer ya boş liste üretir.
 * Accept yalnız benzersiz uzantı; doğrulama tam izin listesi. MIME yok (mükerrer isim yok).
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

/** Windows özel dosyalar — her uzantı bir kez; MIME yok (#2870). `.mov`/`.webm` yok (#2870). */
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
