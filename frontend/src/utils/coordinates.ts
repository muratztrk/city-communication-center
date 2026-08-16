/** Tek kutuda enlem, boylam — "38.089012, 27.735011" veya harita linki (#2713/#2753). */
export function formatCoordinatePair(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }
  return `${latitude}, ${longitude}`
}

export function mapsLinkFromLatLng(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`
}

/** Detay Konum: girilen orijinal Maps linki; yoksa q=lat,lng (#2770). */
export function displayMapsLink(
  locationMapsUrl?: string | null,
  latitude?: number | null,
  longitude?: number | null,
): string {
  const original = locationMapsUrl?.trim()
  if (original) return original
  return mapsLinkFromLatLng(latitude, longitude)
}

export function originalGoogleMapsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || !isGoogleMapsLink(trimmed)) return null
  return trimmed
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

export function isGoogleMapsLink(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|(?:www\.)?google(?:\.[a-z]{2,3})+\/maps/i.test(trimmed)
    || /@-?\d+(?:\.\d+)?,-?\d+/.test(trimmed)
    || /!3d-?\d+(?:\.\d+)?!4d-?\d+/.test(trimmed)
}

export function isShortGoogleMapsLink(value: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(value.trim())
}

/** Konum Koordinatı: yalnızca Google Maps linkinden pin (#2764/#2767). Düz "lat, lng" marker üretmez. */
export function parseGoogleMapsCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const trimmed = value.trim()
  if (!trimmed || !isGoogleMapsLink(trimmed)) return null
  return parseCoordinatePair(trimmed)
}
