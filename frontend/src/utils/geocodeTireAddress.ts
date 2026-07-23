const GEOCODE_CACHE_KEY = 'ccc_geocode_cache_v1'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export type LatLng = { lat: number; lng: number }

type GeocodeCache = Record<string, LatLng | null>

function readCache(): GeocodeCache {
  try {
    const raw = window.localStorage.getItem(GEOCODE_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as GeocodeCache
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(cache: GeocodeCache) {
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Quota / private mode — ignore.
  }
}

function normalizeAddressKey(parts: Array<string | null | undefined>): string {
  return parts
    .map(part => (part ?? '').trim().toLocaleLowerCase('tr'))
    .filter(Boolean)
    .join('|')
}

/** Build a Tire-scoped address string for Nominatim. */
export function buildTireGeocodeQuery(input: {
  neighborhood?: string | null
  street?: string | null
  openAddress?: string | null
}): string {
  const chunks = [
    input.openAddress?.trim(),
    input.street?.trim(),
    input.neighborhood?.trim(),
    'Tire',
    'İzmir',
    'Türkiye',
  ].filter(Boolean)
  return chunks.join(', ')
}

let geocodeQueue: Promise<void> = Promise.resolve()

/**
 * Geocode an address via Nominatim with localStorage cache and ~1 req/s pacing.
 * Returns null when no match (caller should skip the pin).
 */
export function geocodeTireAddress(input: {
  neighborhood?: string | null
  street?: string | null
  openAddress?: string | null
}): Promise<LatLng | null> {
  const cacheKey = normalizeAddressKey([input.openAddress, input.street, input.neighborhood])
  if (!cacheKey) return Promise.resolve(null)

  const cache = readCache()
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    return Promise.resolve(cache[cacheKey] ?? null)
  }

  const query = buildTireGeocodeQuery(input)
  const run = async () => {
    // Pace requests to respect Nominatim usage policy.
    await new Promise(resolve => window.setTimeout(resolve, 1100))
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Nominatim requires a valid User-Agent / Referer identifying the app.
      },
    })
    if (!response.ok) {
      cache[cacheKey] = null
      writeCache(cache)
      return null
    }
    const data = await response.json() as Array<{ lat: string; lon: string }>
    const first = data[0]
    const result = first
      ? { lat: Number(first.lat), lng: Number(first.lon) }
      : null
    if (result && (Number.isNaN(result.lat) || Number.isNaN(result.lng))) {
      cache[cacheKey] = null
    } else {
      cache[cacheKey] = result
    }
    writeCache(cache)
    return cache[cacheKey]
  }

  const next = geocodeQueue.then(run, run)
  geocodeQueue = next.then(() => undefined, () => undefined)
  return next
}

/** Tire ilçe merkezi — varsayılan harita merkezi. */
export const TIRE_MAP_CENTER: LatLng = { lat: 38.0885, lng: 27.7346 }

/**
 * Toki (kuzey-doğu) ve İbni Melek (güney) dahil Tire ilçe çerçevesi (card #1848).
 * SW ≈ İbni Melek / güney mahalleler, NE ≈ Toki / kuzey-doğu.
 */
export const TIRE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [38.055, 27.695],
  [38.125, 27.785],
]
