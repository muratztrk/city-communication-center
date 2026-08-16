import { api } from '../api/client'
import { ADDRESS_STREET_NO_MAX_LENGTH, STREET_NO_NONE } from './addressLimits'
import { isGoogleMapsLink, parseGoogleMapsCoordinatePair } from './coordinates'
import { getGoogleMapsApiKey } from './googleMaps'

/** Kısa Maps linki (maps.app.goo.gl) sunucuda açılıp lat/lng çıkarılır (#2767). */
export async function resolveGoogleMapsCoordinatePair(
  value: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = value.trim()
  if (!trimmed) return null
  const direct = parseGoogleMapsCoordinatePair(trimmed)
  if (direct) return direct
  if (!isGoogleMapsLink(trimmed) || !/^https?:\/\//i.test(trimmed)) return null
  return api.resolveMapsCoordinates(trimmed)
}

export type MapsResolvedAddress = {
  neighborhood: string
  street: string
  streetNo: string
  latitude?: number
  longitude?: number
}

let geocoderLoader: Promise<google.maps.Geocoder | null> | null = null

async function loadGeocoder(): Promise<google.maps.Geocoder | null> {
  if (typeof google !== 'undefined' && google.maps?.Geocoder) {
    return new google.maps.Geocoder()
  }
  const key = getGoogleMapsApiKey()
  if (!key) return null
  if (!geocoderLoader) {
    geocoderLoader = new Promise(resolve => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-ccc-maps-geocoder]')
      const finish = () => {
        resolve(typeof google !== 'undefined' && google.maps?.Geocoder ? new google.maps.Geocoder() : null)
      }
      if (existing) {
        if (typeof google !== 'undefined' && google.maps?.Geocoder) {
          finish()
          return
        }
        existing.addEventListener('load', finish)
        existing.addEventListener('error', () => resolve(null))
        return
      }
      const script = document.createElement('script')
      const callbackName = `__cccMapsGeocoderReady_${Date.now()}`
      ;(window as unknown as Record<string, () => void>)[callbackName] = finish
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=tr&callback=${callbackName}`
      script.async = true
      script.dataset.cccMapsGeocoder = '1'
      script.onload = finish
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }
  return geocoderLoader
}

function componentName(
  result: google.maps.GeocoderResult,
  types: string[],
): string {
  const match = result.address_components?.find(component => types.some(type => component.types.includes(type)))
  return match?.long_name?.trim() ?? ''
}

/** Google reverse geocode: kapı no; yoksa null (#2719). */
export async function streetNoFromGoogleMaps(lat: number, lng: number): Promise<string | null> {
  const geocoder = await loadGeocoder()
  if (!geocoder) return null
  try {
    const response = await geocoder.geocode({ location: { lat, lng } })
    for (const result of response.results ?? []) {
      const streetNo = componentName(result, ['street_number'])
      if (streetNo) return streetNo
    }
  } catch {
    return null
  }
  return null
}

/**
 * Mahalle/cadde boş + Maps linki: link parse edilmez; Google `address=` araması (#2770).
 */
export async function enrichEmptyAddressFromMapsLink(input: {
  neighborhood: string
  street: string
  streetNo: string
  coordinates: string
  districtId: string
}): Promise<MapsResolvedAddress> {
  const neighborhood = input.neighborhood.trim()
  const street = input.street.trim()
  if (neighborhood || street) {
    return { neighborhood: input.neighborhood, street: input.street, streetNo: input.streetNo }
  }

  const fromApi = await api.resolveMapsAddressFromLink(input.coordinates, input.districtId)
  if (!fromApi) {
    return { neighborhood: input.neighborhood, street: input.street, streetNo: input.streetNo }
  }

  const mapsStreetNo = fromApi.streetNo.trim()
  return {
    neighborhood: fromApi.neighborhood,
    street: fromApi.street,
    streetNo: mapsStreetNo && mapsStreetNo.length <= ADDRESS_STREET_NO_MAX_LENGTH
      ? mapsStreetNo
      : STREET_NO_NONE,
    latitude: fromApi.latitude,
    longitude: fromApi.longitude,
  }
}
