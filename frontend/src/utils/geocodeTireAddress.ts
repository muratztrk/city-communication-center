const GEOCODE_CACHE_KEY = 'ccc_geocode_cache_v2'

export type LatLng = { lat: number; lng: number }

type GeocodeCache = Record<string, LatLng | null>

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
  openAddress?: string | null
  /** Kurum Konumu ilçe adı; varsayılan Tire (#r512). */
  districtName?: string | null
}): string {
  const district = input.districtName?.trim() || 'Tire'
  const chunks = [
    input.openAddress?.trim(),
    input.street?.trim(),
    input.neighborhood?.trim(),
    district,
    'İzmir',
    'Türkiye',
  ].filter(Boolean)
  return chunks.join(', ')
}

let geocodeQueue: Promise<void> = Promise.resolve()

/**
 * Geocode an address via the Maps JS API Geocoder with localStorage cache.
 * Returns null when no match or the JS API isn't loaded (caller should skip the pin).
 */
export function geocodeTireAddress(input: {
  neighborhood?: string | null
  street?: string | null
  openAddress?: string | null
  districtName?: string | null
}): Promise<LatLng | null> {
  const district = input.districtName?.trim() || 'Tire'
  const cacheKey = normalizeAddressKey([input.openAddress, input.street, input.neighborhood, district])
  if (!cacheKey) return Promise.resolve(null)

  const cache = readCache()
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
    return Promise.resolve(cache[cacheKey] ?? null)
  }

  const query = buildTireGeocodeQuery(input)
  const run = async () => {
    const client = getGeocoder()
    // JS API henüz yüklü değil / anahtar yok: cache'e yazmadan geç, yüklenince tekrar denenir.
    if (!client) return null

    // Light client throttle between sequential pin geocodes.
    await new Promise(resolve => window.setTimeout(resolve, 80))

    // Callback formu status'u açıkça verir (promise formu non-OK'te reject eder ve
    // reject şekli sürüme göre değişir) — status'a göre cache kararı vermek için gerekli.
    const { status, results } = await new Promise<{
      status: string
      results: google.maps.GeocoderResult[] | null
    }>(resolve => {
      client.geocode({ address: query, region: 'tr' }, (geoResults, geoStatus) => {
        resolve({ status: String(geoStatus), results: geoResults })
      })
    })

    // Yalnız ZERO_RESULTS gerçek "adres yok" demek. REQUEST_DENIED (yanlış/kısıtlı anahtar),
    // OVER_QUERY_LIMIT, UNKNOWN_ERROR geçici/konfig hatası — bunları localStorage'a negatif
    // yazarsak anahtar düzeltilse bile adres bir daha hiç sorgulanmaz (hasOwnProperty hit).
    if (status !== 'OK' && status !== 'ZERO_RESULTS') return null

    const location = status === 'OK' ? results?.[0]?.geometry?.location : undefined
    const result = location
      ? { lat: location.lat(), lng: location.lng() }
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

/** Tire ilçe merkezi — varsayılan harita merkezi (geriye uyum). */
export const TIRE_MAP_CENTER: LatLng = { lat: 38.0885, lng: 27.7346 }

/**
 * Toki (kuzey-doğu) ve İbni Melek (güney) dahil Tire ilçe çerçevesi (card #1848).
 * SW ≈ İbni Melek / güney mahalleler, NE ≈ Toki / kuzey-doğu.
 */
export const TIRE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [38.055, 27.695],
  [38.125, 27.785],
]
