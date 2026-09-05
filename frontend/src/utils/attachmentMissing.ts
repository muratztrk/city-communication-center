export type AttachmentOwnerKind = 'job' | 'task'

export function attachmentMissingMessage(ownerKind: AttachmentOwnerKind): string {
  return ownerKind === 'task'
    ? 'Görev eki sistemde bulunamadı. Sistem yöneticiniz ile iletişime geçiniz.'
    : 'Talep eki sistemde bulunamadı. Sistem yöneticiniz ile iletişime geçiniz.'
}

export function resolveAttachmentMissingMessage(error: unknown, ownerKind: AttachmentOwnerKind): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return attachmentMissingMessage(ownerKind)
}
