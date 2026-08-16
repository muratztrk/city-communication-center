import { api } from '../api/client'
import { isAbsentStreetNo } from './addressLimits'

export type LatLng = { lat: number; lng: number }

/**
 * `address` = CBS kapı noktası. `approximate` = no yok (cadde orta hattı) veya mahalle yedeği.
 * Marker konumu Google adres araması değil; İzmir CBS (#2696).
 */
export type GeocodePrecision = 'address' | 'approximate'

export type GeocodeHit = { position: LatLng; precision: GeocodePrecision }

const GEOCODE_CONCURRENCY = 4
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

function cacheKey(input: {
  districtId?: string | null
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  allowNeighborhoodFallback?: boolean
}): string {
  return [
    input.districtId,
    input.neighborhood,
    input.street,
    input.streetNo,
    input.allowNeighborhoodFallback ? 'nb' : '',
  ]
    .map(part => (part ?? '').trim().toLocaleLowerCase('tr'))
    .join('|')
}

/** İzmir CBS kapı/cadde/mahalle noktası — Google Geocoder kullanılmaz (#2696). */
export function geocodeTireAddress(input: {
  districtId?: string | null
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
  districtName?: string | null
  allowNeighborhoodFallback?: boolean
}): Promise<GeocodeHit | null> {
  const street = input.street?.trim()
  const neighborhood = input.neighborhood?.trim()
  if (!street && !(input.allowNeighborhoodFallback && neighborhood)) {
    return Promise.resolve(null)
  }
  const key = cacheKey(input)
  if (!key.replace(/\|/g, '')) return Promise.resolve(null)

  const existing = geocodeInflight.get(key)
  if (existing) return existing

  const next = (async () => {
    await acquireGeocodeSlot()
    try {
      const hit = await api.getIzmirCbsPoint({
        districtId: input.districtId ?? '',
        neighborhood,
        street,
        streetNo: isAbsentStreetNo(input.streetNo) ? undefined : input.streetNo,
        allowNeighborhoodFallback: input.allowNeighborhoodFallback,
      })
      if (!hit) return null
      return {
        position: { lat: hit.latitude, lng: hit.longitude },
        precision: hit.approximate ? 'approximate' : 'address',
      } satisfies GeocodeHit
    } catch {
      return null
    } finally {
      releaseGeocodeSlot()
      geocodeInflight.delete(key)
    }
  })()

  geocodeInflight.set(key, next)
  return next
}
