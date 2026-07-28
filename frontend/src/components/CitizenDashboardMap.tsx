import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api/client'
import type { CitizenDashboardMapPin, JobDetail, SocialMessage } from '../types/platform'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { geocodeTireAddress, type LatLng } from '../utils/geocodeTireAddress'
import { getDistrictMapView } from '../data/izmir-district-maps'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from '../utils/googleMaps'

type ResolvedPin = CitizenDashboardMapPin & { position: LatLng }

function pinColor(displayStatus: string): string {
  return displayStatus === 'inProgress' ? '#22c55e' : '#0ea5e9'
}

// Marker `icon` shallow-compare edilir; her render'da yeni obje üretmek tüm pinlerde
// gereksiz setIcon tetikler. Renk başına tek örnek tut (google.* yüklendikten sonra kurulur).
const pinIconCache = new Map<string, google.maps.Icon>()

function pinSvgIcon(color: string): google.maps.Icon {
  const cached = pinIconCache.get(color)
  if (cached) return cached
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`
  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(22, 22),
    anchor: new google.maps.Point(11, 11),
  }
  pinIconCache.set(color, icon)
  return icon
}

function getDetailStatusClass(status: string): string {
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested') return 'text-red-600'
  if (status === 'Active' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval') return 'text-[#f97316]'
  return 'text-slate-900'
}

function getDetailStatusLabel(t: TFunction, detail: JobDetail): string {
  if (isCitizenRequestJob(detail)) {
    return getCitizenRequestStatusLabel(t, detail)
  }
  return t(`enum.jobStatus.${detail.status}`, { defaultValue: detail.status })
}

async function loadCitizenSourceMessage(detail: JobDetail): Promise<SocialMessage | null> {
  if (!detail.sourceRefId) return null
  try {
    return await api.getSocialMessageById(detail.sourceRefId)
  } catch {
    return null
  }
}

interface CitizenDashboardMapProps {
  pins: CitizenDashboardMapPin[]
  loading?: boolean
}

const MAP_CONTAINER_STYLE: CSSProperties = { width: '100%', height: '100%' }

/**
 * Kontrol Paneli Vatandaş — Kurum Konumu ilçesine göre açık adresli İşleme Alındı / Yapılmakta pinleri (card #1834 / #r512).
 * Google Maps JavaScript API (#r540).
 */
export function CitizenDashboardMap({ pins, loading }: CitizenDashboardMapProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const districtId = useMunicipalityDistrictId()
  const mapView = useMemo(() => getDistrictMapView(districtId), [districtId])
  const mapsReady = isGoogleMapsConfigured()
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ccc-google-maps',
    googleMapsApiKey: getGoogleMapsApiKey(),
    language: 'tr',
    region: 'TR',
  })
  const [resolved, setResolved] = useState<ResolvedPin[]>([])
  const [resolving, setResolving] = useState(false)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activePinId, setActivePinId] = useState<string | null>(null)
  const [gestureHandling, setGestureHandling] = useState<'none' | 'greedy'>('none')
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)

  // Geocode JS API Geocoder'a bağlı: yüklenmeden koşarsak adresli pinler düşer ve
  // effect bir daha tetiklenmez. Anahtar yok / yükleme hatasında da koş — o durumda
  // sadece koordinatı hazır pinler kalır, `resolving` askıda bırakılmaz.
  const geocodeReady = !mapsReady || loadError != null || isLoaded

  useEffect(() => {
    if (!geocodeReady) return
    let cancelled = false
    setResolving(true)
    void (async () => {
      const next: ResolvedPin[] = []
      for (const pin of pins) {
        if (cancelled) return
        if (pin.latitude != null && pin.longitude != null) {
          next.push({ ...pin, position: { lat: pin.latitude, lng: pin.longitude } })
          continue
        }
        const position = await geocodeTireAddress({
          neighborhood: pin.neighborhood,
          street: pin.street,
          openAddress: pin.openAddress,
          districtName: mapView.districtName,
        })
        if (position) {
          next.push({ ...pin, position })
        }
      }
      if (!cancelled) {
        setResolved(next)
        setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtName, geocodeReady])

  // Fit view: pinsiz zoom 14; tek pin 16; çok pin ilçe+pin bounds maxZoom 15 (#1867).
  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    const [[swLat, swLng], [neLat, neLng]] = mapView.bounds
    if (resolved.length === 0) {
      mapInstance.setCenter({ lat: mapView.center.lat, lng: mapView.center.lng })
      mapInstance.setZoom(14)
      return
    }
    if (resolved.length === 1) {
      mapInstance.setCenter({ lat: resolved[0].position.lat, lng: resolved[0].position.lng })
      mapInstance.setZoom(16)
      return
    }
    const bounds = new google.maps.LatLngBounds(
      { lat: swLat, lng: swLng },
      { lat: neLat, lng: neLng },
    )
    for (const pin of resolved) {
      bounds.extend({ lat: pin.position.lat, lng: pin.position.lng })
    }
    mapInstance.fitBounds(bounds, 24)
    const listener = google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      const zoom = mapInstance.getZoom()
      if (zoom != null && zoom > 15) mapInstance.setZoom(15)
    })
    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [mapInstance, isLoaded, resolved, mapView.bounds, mapView.center])

  const statusLegend = useMemo(() => ([
    { key: 'processingReceived', label: t('dashboard.chart.citizenProcessingReceived', 'İşleme Alındı') },
    { key: 'inProgress', label: t('dashboard.chart.inProgress', 'Yapılmakta Olan') },
  ]), [t])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map)
  }, [])

  async function openJobDetail(jobId: string) {
    setJobDetail(null)
    setCitizenSourceMessage(null)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await api.getJobById(jobId)
      setJobDetail(detail)
      setCitizenSourceMessage(await loadCitizenSourceMessage(detail))
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeJobDetail() {
    setJobDetail(null)
    setCitizenSourceMessage(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  const activePin = resolved.find(pin => pin.jobId === activePinId) ?? null

  return (
    <section className="section-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-slate-800 sm:text-lg">
            {t('dashboard.citizenMap.title', {
              district: mapView.districtName,
              defaultValue: '{{district}} Haritası - Açık Adresli Talepler',
            })}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {t('dashboard.citizenMap.subtitle', 'İşleme alınan ve yapılmakta olan talepler açık adresleriyle haritada gösterilir.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
          {statusLegend.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${item.key === 'inProgress' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
              {item.label}
            </span>
          ))}
          <span className="text-slate-400">
            {loading || resolving
              ? t('common.loading', 'Yükleniyor...')
              : t('dashboard.citizenMap.pinCount', { count: resolved.length, defaultValue: '{{count}} konum' })}
          </span>
        </div>
      </div>

      <div
        className="relative h-[min(28rem,55vh)] w-full bg-slate-100"
        onMouseLeave={() => setGestureHandling('none')}
      >
        {!mapsReady || loadError ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm font-medium text-slate-600">
            {t('location.mapNotConfigured', 'Harita yapılandırılmadı. Google Maps API anahtarı gerekli.')}
          </div>
        ) : !isLoaded ? (
          <div className="flex size-full items-center justify-center text-sm text-slate-500">
            {t('common.loading', 'Yükleniyor...')}
          </div>
        ) : (
          <GoogleMap
            key={mapView.districtId}
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={{ lat: mapView.center.lat, lng: mapView.center.lng }}
            zoom={14}
            onLoad={onMapLoad}
            onClick={() => setGestureHandling('greedy')}
            options={{
              gestureHandling,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              clickableIcons: false,
            }}
          >
            {resolved.map(pin => (
              <Marker
                key={pin.jobId}
                position={{ lat: pin.position.lat, lng: pin.position.lng }}
                icon={pinSvgIcon(pinColor(pin.displayStatus))}
                onClick={() => setActivePinId(pin.jobId)}
              />
            ))}
            {activePin ? (
              <InfoWindow
                position={{ lat: activePin.position.lat, lng: activePin.position.lng }}
                onCloseClick={() => setActivePinId(null)}
              >
                <div className="max-w-[16rem]">
                  <button
                    type="button"
                    className="cursor-pointer text-left text-sm font-semibold text-[color:var(--color-primary)] underline-offset-2 hover:underline"
                    onClick={() => void openJobDetail(activePin.jobId)}
                  >
                    {activePin.title}
                  </button>
                  {activePin.openAddress ? (
                    <div className="mt-1 text-[11px] leading-snug text-slate-500">{activePin.openAddress}</div>
                  ) : null}
                </div>
              </InfoWindow>
            ) : null}
          </GoogleMap>
        )}
        {!loading && !resolving && pins.length > 0 && resolved.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center px-4">
            <div className="rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow">
              {t('dashboard.citizenMap.geocodeEmpty', 'Açık adresler haritada konumlanamadı.')}
            </div>
          </div>
        ) : null}
      </div>

      {(jobDetail || detailLoading || detailError) ? createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {jobDetail ? (
            <MyRequestDetailModal
              detail={jobDetail}
              title={t('nav.myRequests', 'Taleplerim')}
              locale={locale}
              detailLoading={detailLoading}
              citizenSourceMessage={citizenSourceMessage}
              detailStatusClass={getDetailStatusClass(jobDetail.status)}
              statusContent={getDetailStatusLabel(t, jobDetail)}
              canChangeDueDate={false}
              detailDueDateEdit={null}
              onOpenDueDateEdit={() => undefined}
              onCloseDueDateEdit={() => undefined}
              onDueDateChange={() => undefined}
              onDueDateSave={() => undefined}
              onClose={closeJobDetail}
              onPrint={() => window.print()}
              showManagerNoteColumn={false}
              canEditManagerNote={false}
              canManageCoordination={false}
              managerNoteDraft=""
              managerNoteEditing={false}
              managerNoteSaved={false}
              managerNoteSaving={false}
              onManagerNoteDraftChange={() => undefined}
              onManagerNoteEditStart={() => undefined}
              onManagerNoteSave={() => undefined}
              onManagerNoteDeleteConfirm={() => undefined}
              setConfirmDialog={() => undefined}
              canEditJobAttachments={false}
              showAttachmentLockNotice={false}
              attachmentLockText=""
              attachmentUploading={false}
              onAttachmentUpload={async () => undefined}
              onAttachmentDelete={async () => undefined}
              onDownloadTaskAttachment={() => undefined}
            />
          ) : (
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
              {detailLoading ? <div className="loading">{t('common.loading')}</div> : null}
              {detailError ? <div className="error">{detailError}</div> : null}
            </div>
          )}
        </div>,
        document.body,
      ) : null}
    </section>
  )
}
