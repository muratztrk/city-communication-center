/** Tek kutuda enlem, boylam — "38.089012, 27.735011" veya harita linki (#2713/#2753). */
export function formatCoordinatePair(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }
  return `${latitude}, ${longitude}`
}

function finitePair(rawLat: string, rawLng: string): { latitude: number; longitude: number } | null {
  const latitude = Number(rawLat.replace(',', '.'))
  const longitude = Number(rawLng.replace(',', '.'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

export function parseCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const plain = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/)
  if (plain) return finitePair(plain[1], plain[2])

  const at = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) return finitePair(at[1], at[2])

  const bang = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (bang) return finitePair(bang[1], bang[2])

  const query = trimmed.match(/[?&#](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?)(?:%2C|,|\+)(-?\d+(?:\.\d+)?)/i)
  if (query) return finitePair(query[1], query[2])

  return null
}
