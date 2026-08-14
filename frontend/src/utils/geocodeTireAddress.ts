import { canonicalizeNeighborhoodForGeocode } from '../data/izmir-locations'

const GEOCODE_CACHE_KEY = 'ccc_geocode_cache_v5'

export type LatLng = { lat: number; lng: number }

/**
 * `address` = mahalle + cadde + no ile bulundu. `approximate` = no yok veya cadde/mahalle
 * seviyesine düşüldü — pin boş alana kaydırılır (#2594).
 */
export type GeocodePrecision = 'address' | 'approximate'

export type GeocodeHit = { position: LatLng; precision: GeocodePrecision }

type CachedHit = { lat: number; lng: number; approx?: true }

type GeocodeCache = Record<string, CachedHit | null>

/**
 * Maps JS API Geocoder — REST web service DEĞİL. Web service HTTP referrer kısıtını
 * desteklemez (REQUEST_DENIED döner); JS API destekler, böylece tek referrer-kısıtlı
 * anahtar Maps JS + Embed + geocode'un hepsini karşılar (#r540).
 */
let geocoder: google.maps.Geocoder | null = null

function getGeocoder(): google.maps.Geocoder | null {
  if (typeof google === 'undefined' || !google.maps?.Geocoder) return null
  geocoder ??= new google.maps.Geocoder()
  return geocoder
}

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

/** Build a district-scoped address string for Google Geocoding. */
export function buildTireGeocodeQuery(input: {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
  districtName?: string | null
}): string {
  const district = input.districtName?.trim() || 'Tire'
  const neighborhood = canonicalizeNeighborhoodForGeocode(input.neighborhood, district)
  const streetWithNo = [input.street?.trim(), input.streetNo?.trim()].filter(Boolean).join(' ')
  const chunks = [
    streetWithNo || undefined,
    neighborhood || undefined,
    district,
    'İzmir',
    'Türkiye',
  ].filter(Boolean)
  return chunks.join(', ')
}

function buildGeocodeQueryVariants(input: {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  districtName?: string | null
}): string[] {
  const district = input.districtName?.trim() || 'Tire'
  const tail = [district, 'İzmir', 'Türkiye']
  const street = input.street?.trim()
  const streetNo = input.streetNo?.trim()
  const neighborhood = canonicalizeNeighborhoodForGeocode(input.neighborhood, district)
  const variants: string[][] = []
  if (street && streetNo && neighborhood) {
    variants.push([`${street} ${streetNo}`, neighborhood, ...tail])
    variants.push([street, neighborhood, ...tail])
  } else if (street && streetNo) {
    variants.push([`${street} ${streetNo}`, ...tail])
    variants.push([street, ...tail])
  } else if (street && neighborhood) {
    variants.push([street, neighborhood, ...tail])
  } else if (street) {
    variants.push([street, ...tail])
  } else if (neighborhood) {
    variants.push([neighborhood, ...tail])
  }

  return [...new Set(variants.map(parts => parts.filter(Boolean).join(', ')))]
    .filter(query => query !== tail.join(', '))
}

let geocodeQueue: Promise<void> = Promise.resolve()

/**
 * Geocode mahalle / cadde / no via Maps JS API Geocoder with localStorage cache.
 * No yoksa cadde+mahalle seviyesinde `precision: 'approximate'` döner (#2594).
 * Returns null when nothing resolves or the JS API isn't loaded.
 */
export function geocodeTireAddress(input: {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
  districtName?: string | null
}): Promise<GeocodeHit | null> {
  const district = input.districtName?.trim() || 'Tire'
  const neighborhood = canonicalizeNeighborhoodForGeocode(input.neighborhood, district)
  const cacheKey = normalizeAddressKey([input.street, input.streetNo, neighborhood, district])
  if (!cacheKey) return Promise.resolve(null)

  const toHit = (cached: CachedHit | null): GeocodeHit | null => (cached
    ? { position: { lat: cached.lat, lng: cached.lng }, precision: cached.approx ? 'approximate' : 'address' }
    : null)

  const cache = readCache()
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    return Promise.resolve(toHit(cache[cacheKey] ?? null))
  }

  const hasStreetNo = Boolean(input.streetNo?.trim())
  const variants = buildGeocodeQueryVariants(input)
  const run = async (): Promise<GeocodeHit | null> => {
    const client = getGeocoder()
    if (!client) return null

    for (let index = 0; index < variants.length; index += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 80))

      const { status, results } = await new Promise<{
        status: string
        results: google.maps.GeocoderResult[] | null
      }>(resolve => {
        client.geocode({ address: variants[index], region: 'tr' }, (geoResults, geoStatus) => {
          resolve({ status: String(geoStatus), results: geoResults })
        })
      })

      if (status !== 'OK' && status !== 'ZERO_RESULTS') return null
      if (status === 'ZERO_RESULTS') continue

      const location = results?.[0]?.geometry?.location
      if (!location) continue
      const lat = location.lat()
      const lng = location.lng()
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue

      const approximate = !hasStreetNo || index > 0
      const hit: CachedHit = approximate ? { lat, lng, approx: true } : { lat, lng }
      cache[cacheKey] = hit
      writeCache(cache)
      return toHit(hit)
    }

    cache[cacheKey] = null
    writeCache(cache)
    return null
  }

  const next = geocodeQueue.then(run, run)
  geocodeQueue = next.then(() => undefined, () => undefined)
  return next
}

/** Tire ilçe merkezi — varsayılan harita merkezi (geriye uyum). */
export const TIRE_MAP_CENTER: LatLng = { lat: 38.0885, lng: 27.7346 }

export const TIRE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [38.055, 27.695],
  [38.125, 27.785],
]
