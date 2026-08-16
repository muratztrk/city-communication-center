/** Tek kutuda enlem, boylam — "38.089012, 27.735011" (#2713). */
export function formatCoordinatePair(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }
  return `${latitude}, ${longitude}`
}

export function parseCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/)
  if (!match) return null
  const latitude = Number(match[1].replace(',', '.'))
  const longitude = Number(match[2].replace(',', '.'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}
