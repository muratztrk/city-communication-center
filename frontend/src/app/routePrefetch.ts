const prefetched = new Set<string>()

const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  '/whatsapp': () => import('../pages/WhatsAppConversationsPage'),
}

/** Warm a lazy route chunk on sidebar hover/focus so navigation feels instant. */
export function prefetchRouteChunk(path: string) {
  const basePath = path.split('?')[0]
  const load = routeChunkLoaders[basePath]
  if (!load || prefetched.has(basePath)) return

  prefetched.add(basePath)
  void load().catch(() => {
    prefetched.delete(basePath)
  })
}
