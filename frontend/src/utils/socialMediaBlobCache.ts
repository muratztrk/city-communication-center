/** In-memory LRU for WhatsApp conversation media blobs (#6a758a88). */

const MAX_ENTRIES = 40
const MAX_TOTAL_BYTES = 48 * 1024 * 1024

type CacheEntry = {
  blob: Blob
  size: number
}

const cache = new Map<string, CacheEntry>()
let totalBytes = 0

function cacheKey(socialMessageId: string, entryId: string): string {
  return `${socialMessageId}:${entryId}`
}

function touch(key: string, entry: CacheEntry) {
  cache.delete(key)
  cache.set(key, entry)
}

function evictIfNeeded(incomingSize: number) {
  while (
    cache.size > 0
    && (cache.size >= MAX_ENTRIES || totalBytes + incomingSize > MAX_TOTAL_BYTES)
  ) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (!oldestKey) break
    const oldest = cache.get(oldestKey)
    cache.delete(oldestKey)
    if (oldest) totalBytes = Math.max(0, totalBytes - oldest.size)
  }
}

export function getCachedSocialMediaBlob(socialMessageId: string, entryId: string): Blob | null {
  const key = cacheKey(socialMessageId, entryId)
  const entry = cache.get(key)
  if (!entry) return null
  touch(key, entry)
  return entry.blob
}

export function setCachedSocialMediaBlob(socialMessageId: string, entryId: string, blob: Blob): void {
  const key = cacheKey(socialMessageId, entryId)
  const size = blob.size
  const existing = cache.get(key)
  if (existing) {
    totalBytes = Math.max(0, totalBytes - existing.size)
    cache.delete(key)
  }
  evictIfNeeded(size)
  cache.set(key, { blob, size })
  totalBytes += size
}

/** Test/logout helper — clears all cached media. */
export function clearSocialMediaBlobCache(): void {
  cache.clear()
  totalBytes = 0
}
