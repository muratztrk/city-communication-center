import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
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

type ResolvedPin = CitizenDashboardMapPin & { position: LatLng; approximate: boolean }

const PIN_COLORS: Record<string, string> = {
  processingReceived: '#0ea5e9',
  inProgress: '#f97316',
  overdue: '#ef4444',
  completed: '#22c55e',
}

function pinColor(displayStatus: string): string {
  return PIN_COLORS[displayStatus] ?? PIN_COLORS.processingReceived
}

const pinIconCache = new Map<string, google.maps.Icon>()

function pinSvgIcon(color: string, approximate: boolean): google.maps.Icon {
  const cacheKey = `${color}|${approximate ? 'approx' : 'exact'}`
  const cached = pinIconCache.get(cacheKey)
  if (cached) return cached
  const ring = approximate
    ? `<circle cx="11" cy="11" r="9" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"/>
       <circle cx="11" cy="11" r="5" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>`
    : `<circle cx="11" cy="11" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">${ring}</svg>`
  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(22, 22),
    anchor: new google.maps.Point(11, 11),
  }
  pinIconCache.set(cacheKey, icon)
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

interface CitizenRequestMapProps {
  pins: CitizenDashboardMapPin[]
  loading?: boolean
}

const MAP_CONTAINER_STYLE: CSSProperties = { width: '100%', height: '100%' }

export function CitizenRequestMap({ pins, loading }: CitizenRequestMapProps) {
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
  const [unpinned, setUnpinned] = useState<string[]>([])
  const [resolving, setResolving] = useState(false)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activePinId, setActivePinId] = useState<string | null>(null)
  const [gestureHandling, setGestureHandling] = useState<'none' | 'greedy'>('none')
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  const geocodeReady = !mapsReady || loadError != null || isLoaded

  useEffect(() => {
    if (!geocodeReady) return
    let cancelled = false
    setResolving(true)
    void (async () => {
      const next: ResolvedPin[] = []
      const failed: string[] = []
      for (const pin of pins) {
        if (cancelled) return
        if (pin.latitude != null && pin.longitude != null) {
          next.push({ ...pin, position: { lat: pin.latitude, lng: pin.longitude }, approximate: false })
          continue
        }
        const hit = await geocodeTireAddress({
          neighborhood: pin.neighborhood,
          street: pin.street,
          streetNo: pin.streetNo,
          openAddress: pin.openAddress,
          districtName: mapView.districtName,
        })
        if (hit) {
          next.push({ ...pin, position: hit.position, approximate: hit.precision === 'approximate' })
        } else {
          failed.push(pin.title)
        }
      }
      if (!cancelled) {
        setResolved(next)
        setUnpinned(failed)
        setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtName, geocodeReady])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    const [[swLat, swLng], [neLat, neLng]] = mapView.bounds
    if (resolved.length === 0) {
      mapInstance.setCenter({ lat: mapView.center.lat, lng: mapView.center.lng })
      mapInstance.setZoom(12)
      return
    }
    if (resolved.length === 1) {
      mapInstance.setCenter({ lat: resolved[0].position.lat, lng: resolved[0].position.lng })
      mapInstance.setZoom(12)
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
      if (zoom != null && zoom > 13) mapInstance.setZoom(13)
    })
    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [mapInstance, isLoaded, resolved, mapView.bounds, mapView.center])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    clustererRef.current?.clearMarkers()
    markersRef.current.forEach(marker => {
      google.maps.event.clearInstanceListeners(marker)
      marker.setMap(null)
    })
    markersRef.current = []

    const markers = resolved.map(pin => {
      const marker = new google.maps.Marker({
        position: { lat: pin.position.lat, lng: pin.position.lng },
        icon: pinSvgIcon(pinColor(pin.displayStatus), pin.approximate),
      })
      marker.addListener('click', () => setActivePinId(pin.jobId))
      return marker
    })
    markersRef.current = markers

    clustererRef.current = new MarkerClusterer({
      map: mapInstance,
      markers,
    })

    return () => {
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      markersRef.current.forEach(marker => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, resolved])

  const statusLegend = useMemo(() => ([
    { key: 'processingReceived', label: t('dashboard.chart.citizenProcessingReceived', 'İşleme Alındı'), color: PIN_COLORS.processingReceived },
    { key: 'inProgress', label: t('dashboard.chart.inProgress', 'Yapılmakta Olan'), color: PIN_COLORS.inProgress },
    { key: 'overdue', label: t('citizenRequestMap.legend.overdue', 'Son Tarihi Geçmiş'), color: PIN_COLORS.overdue },
    { key: 'completed', label: t('citizenRequestMap.legend.completed', 'Tamamlanan'), color: PIN_COLORS.completed },
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
    <div className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-slate-800">{t('nav.social', 'Vatandaş Talepleri')}</div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
          {statusLegend.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
          <span className="text-slate-400">
            {loading || resolving
              ? t('common.loading', 'Yükleniyor...')
              : t('citizenRequestMap.pinCount', { count: resolved.length, defaultValue: '{{count}} konum' })}
          </span>
          </div>
        </div>
      </div>

      <div
        className="relative h-[min(36rem,65vh)] w-full bg-slate-100"
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
            zoom={12}
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
                  {activePin.approximate ? (
                    <div className="mt-1 text-[11px] font-medium leading-snug text-amber-600">
                      {t(
                        'citizenRequestMap.approximatePin',
                        'Yaklaşık konum — açık adres tam çözülemedi, mahalle/cadde seviyesinde gösteriliyor.',
                      )}
                    </div>
                  ) : null}
                </div>
              </InfoWindow>
            ) : null}
          </GoogleMap>
        )}
        {!loading && !resolving && unpinned.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center px-4">
            <div
              className="max-w-full rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow"
              title={unpinned.join('\n')}
            >
              {resolved.length === 0
                ? t('citizenRequestMap.geocodeEmpty', 'Adresler haritada konumlanamadı.')
                : t(
                    'citizenRequestMap.geocodePartial',
                    '{{count}} talep adresinden konumlanamadı.',
                    { count: unpinned.length },
                  )}
            </div>
          </div>
        ) : null}
      </div>

      {(jobDetail || detailLoading || detailError) ? createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {jobDetail ? (
            <MyRequestDetailModal
              detail={jobDetail}
              title={t('citizenRequestMap.detailTitle', 'Vatandaş Talep Bilgisi')}
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
    </div>
  )
}
