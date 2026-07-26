/** Entity başına eklerin toplam boyutu üst sınırı (card #r491). */
export const ATTACHMENT_MAX_TOTAL_BYTES = 5 * 1024 * 1024

export function sumFileSizes(files: Array<{ size: number }>): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

export function sumAttachmentBytes(attachments: Array<{ fileSizeBytes?: number | null }>): number {
  return attachments.reduce((sum, attachment) => sum + (attachment.fileSizeBytes ?? 0), 0)
}

/** Mevcut + eklenecek dosyalar 5 MB toplamını aşarsa true. */
export function exceedsAttachmentTotalLimit(existingBytes: number, incomingBytes: number): boolean {
  return existingBytes + incomingBytes > ATTACHMENT_MAX_TOTAL_BYTES
}
