import { useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { getNeighborhoodsForDistrict, getDistrictName } from '../data/izmir-locations'
import { getDistrictMapView } from '../data/izmir-district-maps'

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 13)
  }, [map, lat, lng])
  return null
}

/** Ayarlar → Kurum Konumu: seçili ilçeye göre mahalle listesi + harita önizlemesi (#r512). */
export function MunicipalityLocationPreview({ districtId }: { districtId: string }) {
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const mapView = useMemo(() => getDistrictMapView(districtId), [districtId])
  const districtName = getDistrictName(districtId)

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-slate-700">
          {districtName} mahalleleri ({neighborhoods.length})
        </p>
        <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          {neighborhoods.length === 0 ? (
            <p className="text-xs text-slate-500">Bu ilçe için mahalle listesi yok.</p>
          ) : (
            <ul className="columns-2 gap-x-4 text-xs leading-5 text-slate-700 sm:columns-3">
              {neighborhoods.map(name => (
                <li key={name} className="break-inside-avoid">{name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          {districtName} haritası
        </div>
        <div className="h-52 w-full bg-slate-100">
          <MapContainer
            key={mapView.districtId}
            center={[mapView.center.lat, mapView.center.lng]}
            zoom={13}
            className="size-full z-0"
            scrollWheelZoom={false}
            dragging
            attributionControl={false}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap lat={mapView.center.lat} lng={mapView.center.lng} />
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
