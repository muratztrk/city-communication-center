import { canonicalizeNeighborhoodForGeocode, IZMIR_DISTRICTS } from '../data/izmir-locations'
import { getDistrictMapView } from '../data/izmir-district-maps'

const GEOCODE_CACHE_KEY = 'ccc_geocode_cache_v8'

export type LatLng = { lat: number; lng: number }

/**
 * `address` = cadde + no ile bulundu. `approximate` = no yok, cadde seviyesinde —
 * pin boş alana kaydırılır (#2594). Cadde/sokak yoksa veya Google’da bulunamazsa pin yok (#2635).
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
  allowNeighborhoodFallback?: boolean
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
  }
  if (input.allowNeighborhoodFallback && neighborhood) {
    variants.push([neighborhood, ...tail])
  }

  return [...new Set(variants.map(parts => parts.filter(Boolean).join(', ')))]
    .filter(query => query !== tail.join(', '))
}

function compactGeocodeKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr').replace(/[\s.'’-]+/g, '')
}

function streetCoreForMatch(street: string): string {
  return compactGeocodeKey(street.replace(/(?:caddesi|cadde|cad\.?|sokak|sokağı|sk\.?|bulvarı|bulvar|blv\.?)$/i, ''))
}

function geocodeResultBlob(result: google.maps.GeocoderResult): string {
  const parts = result.address_components?.map(component => `${component.long_name} ${component.short_name}`) ?? []
  return compactGeocodeKey([result.formatted_address, ...parts].join(' '))
}

/** Google/Yandex'te cadde veya mahalle yoksa pin yok (#2599) — ilçe/ülke bulanık eşleşme kabul edilmez. */
function geocodeResultMatchesAddress(
  result: google.maps.GeocoderResult,
  input: { street?: string; neighborhood?: string },
): boolean {
  const blob = geocodeResultBlob(result)
  const types = result.types ?? []
  const locationType = String(result.geometry?.location_type ?? '')
  const adminOnly = types.length > 0 && types.every(type => (
    type === 'locality'
    || type === 'administrative_area_level_1'
    || type === 'administrative_area_level_2'
    || type === 'country'
    || type === 'political'
  ))
  if (adminOnly) return false

  if (input.street) {
    const core = streetCoreForMatch(input.street)
    const full = compactGeocodeKey(input.street)
    const hasStreet = (core.length >= 3 && blob.includes(core)) || (full.length >= 3 && blob.includes(full))
    if (!hasStreet) return false
    if (locationType === 'APPROXIMATE') return false
    return true
  }

  if (input.neighborhood) {
    const neighborhood = compactGeocodeKey(input.neighborhood)
    return neighborhood.length < 3 || blob.includes(neighborhood)
  }

  return false
}

function isInsideDistrictEnvelope(position: LatLng, districtName: string): boolean {
  const district = IZMIR_DISTRICTS.find(item => item.name.toLocaleLowerCase('tr') === districtName.toLocaleLowerCase('tr'))
  const center = getDistrictMapView(district?.id).center
  const span = 0.22
  return Math.abs(position.lat - center.lat) <= span && Math.abs(position.lng - center.lng) <= span
}

const GEOCODE_CONCURRENCY = 4
const GEOCODE_VARIANT_DELAY_MS = 35
let geocodeActive = 0
const geocodeWaiters: Array<() => void> = []
const geocodeInflight = new Map<string, Promise<GeocodeHit | null>>()

function acquireGeocodeSlot(): Promise<void> {
  if (geocodeActive < GEOCODE_CONCURRENCY) {
    geocodeActive += 1
    return Promise.resolve()
  }
  return new Promise(resolve => {
    geocodeWaiters.push(() => {
      geocodeActive += 1
      resolve()
    })
  })
}

function releaseGeocodeSlot() {
  geocodeActive = Math.max(0, geocodeActive - 1)
  const next = geocodeWaiters.shift()
  if (next) next()
}

/**
 * Geocode cadde / no via Maps JS API Geocoder with localStorage cache.
 * Cadde/sokak yoksa veya Google sonucu caddeyi içermiyorsa null (#2635).
 * No yoksa cadde seviyesinde `precision: 'approximate'` döner (#2594).
 */
export function geocodeTireAddress(input: {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
  districtName?: string | null
  allowNeighborhoodFallback?: boolean
}): Promise<GeocodeHit | null> {
  const district = input.districtName?.trim() || 'Tire'
  const street = input.street?.trim()
  const neighborhood = canonicalizeNeighborhoodForGeocode(input.neighborhood, district)
  if (!street && !(input.allowNeighborhoodFallback && neighborhood)) return Promise.resolve(null)
  const cacheKey = normalizeAddressKey([
    street,
    input.streetNo,
    neighborhood,
    district,
    input.allowNeighborhoodFallback ? 'nb' : '',
  ])
  if (!cacheKey) return Promise.resolve(null)

  const toHit = (cached: CachedHit | null): GeocodeHit | null => (cached
    ? { position: { lat: cached.lat, lng: cached.lng }, precision: cached.approx ? 'approximate' : 'address' }
    : null)

  const cache = readCache()
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    return Promise.resolve(toHit(cache[cacheKey] ?? null))
  }

  const hasStreetNo = Boolean(input.streetNo?.trim())
  const variants = buildGeocodeQueryVariants({
    ...input,
    street,
    neighborhood,
    districtName: district,
    allowNeighborhoodFallback: input.allowNeighborhoodFallback,
  })
  const neighborhoodOnlyQuery = neighborhood
    ? [neighborhood, district, 'İzmir', 'Türkiye'].filter(Boolean).join(', ')
    : ''
  const run = async (): Promise<GeocodeHit | null> => {
    const client = getGeocoder()
    if (!client) return null

    for (let index = 0; index < variants.length; index += 1) {
      await new Promise(resolve => window.setTimeout(resolve, GEOCODE_VARIANT_DELAY_MS))
      const variant = variants[index]
      const neighborhoodOnly = Boolean(neighborhoodOnlyQuery && variant === neighborhoodOnlyQuery)

      let status = ''
      let results: google.maps.GeocoderResult[] | null = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await new Promise<{
          status: string
          results: google.maps.GeocoderResult[] | null
        }>(resolve => {
          client.geocode({ address: variant, region: 'tr' }, (geoResults, geoStatus) => {
            resolve({ status: String(geoStatus), results: geoResults })
          })
        })
        status = response.status
        results = response.results
        if (status !== 'OVER_QUERY_LIMIT') break
        await new Promise(resolve => window.setTimeout(resolve, 250))
      }

      if (status !== 'OK' && status !== 'ZERO_RESULTS') return null
      if (status === 'ZERO_RESULTS') continue

      const match = results?.find(result => geocodeResultMatchesAddress(result, {
        street: neighborhoodOnly ? undefined : street,
        neighborhood,
      }))
      const location = match?.geometry?.location
      if (!location) continue
      const lat = location.lat()
      const lng = location.lng()
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue
      if (!isInsideDistrictEnvelope({ lat, lng }, district)) continue

      const approximate = !hasStreetNo || index > 0 || neighborhoodOnly
      const hit: CachedHit = approximate ? { lat, lng, approx: true } : { lat, lng }
      const latest = readCache()
      latest[cacheKey] = hit
      writeCache(latest)
      return toHit(hit)
    }

    const latest = readCache()
    latest[cacheKey] = null
    writeCache(latest)
    return null
  }

  const existing = geocodeInflight.get(cacheKey)
  if (existing) return existing

  const next = (async () => {
    await acquireGeocodeSlot()
    try {
      const latest = readCache()
      if (Object.prototype.hasOwnProperty.call(latest, cacheKey)) {
        return toHit(latest[cacheKey] ?? null)
      }
      return await run()
    } finally {
      releaseGeocodeSlot()
      geocodeInflight.delete(cacheKey)
    }
  })()
  geocodeInflight.set(cacheKey, next)
  return next
}

/** Tire ilçe merkezi — varsayılan harita merkezi (geriye uyum). */
export const TIRE_MAP_CENTER: LatLng = { lat: 38.0885, lng: 27.7346 }

export const TIRE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [38.055, 27.695],
  [38.125, 27.785],
]
