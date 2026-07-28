/** Google Maps Platform helpers — key is build-time `VITE_GOOGLE_MAPS_API_KEY`. */

export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? ''
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0
}

/** Maps Embed API place URL for a lat/lng pin. Returns null when key is missing. */
export function buildGoogleMapsEmbedUrl(latitude: number, longitude: number, zoom = 16): string | null {
  const key = getGoogleMapsApiKey()
  if (!key) return null
  const q = `${latitude},${longitude}`
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&zoom=${zoom}`
}
