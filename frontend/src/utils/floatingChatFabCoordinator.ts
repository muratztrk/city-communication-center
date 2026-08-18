type FabKind = 'whatsapp' | 'internal'

const listeners = new Set<(kind: FabKind | null) => void>()

/** WhatsApp / Kurum İçi Mesajlar FAB — yalnız biri açık (#2858). */
export function subscribeFloatingChatFab(listener: (kind: FabKind | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyFloatingChatFabOpened(kind: FabKind) {
  for (const listener of listeners) {
    listener(kind)
  }
}

export function notifyFloatingChatFabClosed(_kind: FabKind) {
  for (const listener of listeners) {
    listener(null)
  }
}
