import type { LatLng } from '../utils/geocodeTireAddress'
import { IZMIR_DISTRICTS, getSavedDistrictId } from './izmir-locations'

/** İlçe merkezi (yaklaşık) — Kurum Konumu + vatandaş haritası (#r512). */
const DISTRICT_MAP_CENTERS: Record<string, LatLng> = {
  aliaga: { lat: 38.7997, lng: 26.972 },
  balcova: { lat: 38.3897, lng: 27.0594 },
  bayindir: { lat: 38.2175, lng: 27.6481 },
  bayrakli: { lat: 38.4622, lng: 27.1664 },
  bergama: { lat: 39.1207, lng: 27.1805 },
  beydağ: { lat: 38.0867, lng: 28.2156 },
  bornova: { lat: 38.4697, lng: 27.2203 },
  buca: { lat: 38.3861, lng: 27.1772 },
  cesme: { lat: 38.3228, lng: 26.3064 },
  cigli: { lat: 38.4942, lng: 27.07 },
  dikili: { lat: 39.0711, lng: 26.8889 },
  foca: { lat: 38.6703, lng: 26.7567 },
  gaziemir: { lat: 38.3217, lng: 27.1292 },
  guzelbahe: { lat: 38.3706, lng: 26.8889 },
  karabaglar: { lat: 38.3733, lng: 27.1306 },
  karaburun: { lat: 38.6375, lng: 26.5139 },
  karsiyaka: { lat: 38.4592, lng: 27.115 },
  kemalpasa: { lat: 38.4264, lng: 27.4172 },
  kinik: { lat: 39.0872, lng: 27.3833 },
  kiraz: { lat: 38.2306, lng: 28.2044 },
  konak: { lat: 38.4192, lng: 27.1287 },
  menderes: { lat: 38.2542, lng: 27.1342 },
  menemen: { lat: 38.6142, lng: 27.0694 },
  narlidere: { lat: 38.3906, lng: 27 },
  odemis: { lat: 38.2278, lng: 27.9694 },
  seferihisar: { lat: 38.1969, lng: 26.8389 },
  selcuk: { lat: 37.95, lng: 27.3681 },
  tire: { lat: 38.0885, lng: 27.7346 },
  torbali: { lat: 38.1517, lng: 27.3581 },
  urla: { lat: 38.3222, lng: 26.7642 },
}

/** Tire için bilinen çerçeve; diğer ilçelerde merkeze göre yaklaşık kutu. */
const TIRE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [38.055, 27.695],
  [38.125, 27.785],
]

const DEFAULT_SPAN = 0.035

export type DistrictMapView = {
  districtId: string
  districtName: string
  center: LatLng
  bounds: [[number, number], [number, number]]
}

export function getDistrictMapView(districtId?: string | null): DistrictMapView {
  const id = districtId?.trim() || getSavedDistrictId()
  const district = IZMIR_DISTRICTS.find(item => item.id === id) ?? IZMIR_DISTRICTS.find(item => item.id === 'tire')!
  const center = DISTRICT_MAP_CENTERS[district.id] ?? DISTRICT_MAP_CENTERS.tire
  if (district.id === 'tire') {
    return {
      districtId: district.id,
      districtName: district.name,
      center,
      bounds: TIRE_MAP_BOUNDS,
    }
  }
  return {
    districtId: district.id,
    districtName: district.name,
    center,
    bounds: [
      [center.lat - DEFAULT_SPAN, center.lng - DEFAULT_SPAN],
      [center.lat + DEFAULT_SPAN, center.lng + DEFAULT_SPAN],
    ],
  }
}
