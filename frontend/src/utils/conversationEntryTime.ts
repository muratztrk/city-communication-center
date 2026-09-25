const LEGACY_QUEUED_GAP_MS = 30_000

export type ConversationEntryTimeFields = {
  direction: string
  sentAt: string
  deliveryStatus?: string | null
  deliveryStatusUpdatedAtUtc?: string | null
}

/** Balon saati: iletilmiş giden mesajlarda gerçek gönderim; bekleyenlerde kuyruk anı. */
export function resolveConversationEntryBubbleTime(entry: ConversationEntryTimeFields): {
  displayAt: string
  queuedAt: string | null
} {
  if (entry.direction === 'Inbound') {
    return { displayAt: entry.sentAt, queuedAt: null }
  }

  const status = entry.deliveryStatus
  if (!status || status === 'Pending' || status === 'Failed') {
    return { displayAt: entry.sentAt, queuedAt: null }
  }

  const sentMs = new Date(entry.sentAt).getTime()
  const updated = entry.deliveryStatusUpdatedAtUtc
  if (updated) {
    const updatedMs = new Date(updated).getTime()
    if (!Number.isNaN(sentMs) && !Number.isNaN(updatedMs) && updatedMs - sentMs > LEGACY_QUEUED_GAP_MS) {
      return { displayAt: updated, queuedAt: entry.sentAt }
    }
  }

  return { displayAt: entry.sentAt, queuedAt: null }
}

/** Liste saati: konuşmada görünen son giden balonun saati. */
export function latestVisibleOutboundDisplayAt(entries: readonly ConversationEntryTimeFields[]): string | null {
  let latest: string | null = null
  let latestMs = Number.NEGATIVE_INFINITY
  for (const entry of entries) {
    if (entry.direction !== 'Outbound') continue
    const displayAt = resolveConversationEntryBubbleTime(entry).displayAt
    if (!displayAt) continue
    const ms = Date.parse(displayAt)
    if (!Number.isFinite(ms) || ms <= latestMs) continue
    latestMs = ms
    latest = displayAt
  }
  return latest
}

export function compareConversationEntriesByDisplayTime(
  left: ConversationEntryTimeFields,
  right: ConversationEntryTimeFields,
): number {
  const leftMs = new Date(resolveConversationEntryBubbleTime(left).displayAt).getTime()
  const rightMs = new Date(resolveConversationEntryBubbleTime(right).displayAt).getTime()
  return leftMs - rightMs
}
