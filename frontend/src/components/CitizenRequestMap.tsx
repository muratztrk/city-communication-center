import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import {
  ClusterStats,
  MarkerClusterer,
  MarkerClustererEvents,
  MarkerUtils,
  SuperClusterAlgorithm,
  type Cluster,
} from '@googlemaps/markerclusterer'
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

/** Başlangıç zoom'da tek pin bile sayılı cluster; bu zoom ve üstünde durum rengi. */
const NUMBERED_SINGLE_MAX_ZOOM = 13

function readBannerClusterColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--color-header-from').trim()
  return value || '#0B6B36'
}

function clusterSvgIcon(count: number, color: string): google.maps.Icon {
  const size = count < 10 ? 44 : count < 50 ? 52 : 60
  const svg = `<svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <circle cx="120" cy="120" opacity=".55" r="70" />
    <circle cx="120" cy="120" opacity=".28" r="90" />
    <circle cx="120" cy="120" opacity=".16" r="110" />
  </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

const bannerClusterRenderer = {
  render({ count, position }: Cluster): google.maps.Marker {
    const color = readBannerClusterColor()
    const size = count < 10 ? 44 : count < 50 ? 52 : 60
    return new google.maps.Marker({
      position,
      icon: clusterSvgIcon(count, color),
      label: {
        text: String(count),
        color: '#ffffff',
        fontSize: size >= 52 ? '14px' : '12px',
        fontWeight: '700',
      },
      zIndex: 1000 + count,
    })
  },
}

function onCitizenClusterClick(_: google.maps.MapMouseEvent, cluster: Cluster, map: google.maps.Map) {
  const current = map.getZoom() ?? 12
  if (cluster.markers.length <= 1) {
    map.panTo(cluster.position)
    map.setZoom(Math.min(current + 2, 16))
    return
  }
  if (!cluster.bounds) return
  map.fitBounds(cluster.bounds, 80)
  google.maps.event.addListenerOnce(map, 'idle', () => {
    const zoom = map.getZoom()
    if (zoom == null) return
    map.setZoom(Math.max(current + 1, Math.min(zoom - 1, current + 2)))
  })
}

/** Tek pin bile başlangıçta sayılı cluster; yeterince zoom'da durum renkli marker. */
class CitizenMapClusterer extends MarkerClusterer {
  protected renderClusters(): void {
    const stats = new ClusterStats(this.markers, this.clusters)
    const map = this.getMap() as google.maps.Map | null
    if (!map) return
    const zoom = map.getZoom() ?? 0
    this.clusters.forEach(cluster => {
      const showNumbered = cluster.markers.length > 1 || zoom <= NUMBERED_SINGLE_MAX_ZOOM
      if (!showNumbered) {
        cluster.marker = cluster.markers[0]
      } else {
        cluster.marker = this.renderer.render(cluster, stats, map)
        cluster.markers.forEach(marker => MarkerUtils.setMap(marker, null))
        if (this.onClusterClick && cluster.marker) {
          cluster.marker.addListener(MarkerClustererEvents.CLUSTER_CLICK, (event: google.maps.MapMouseEvent) => {
            google.maps.event.trigger(this, MarkerClustererEvents.CLUSTER_CLICK, cluster)
            this.onClusterClick(event, cluster, map)
          })
        }
      }
      if (cluster.marker) MarkerUtils.setMap(cluster.marker, map)
    })
  }
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

const MAP_CONTAINER_STYLE: CSSProperties = { width: '100%', height: '100%', cursor: 'grab' }

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
  const [gestureHandling, setGestureHandling] = useState<'none' | 'greedy'>('none')
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  const geocodeReady = !mapsReady || loadError != null || isLoaded

  useEffect(() => {
    if (!geocodeReady) return
    let cancelled = false
    const fallback = mapView.center

    const withCoords: ResolvedPin[] = []
    const needsGeocode: CitizenDashboardMapPin[] = []
    for (const pin of pins) {
      if (pin.latitude != null && pin.longitude != null) {
        withCoords.push({ ...pin, position: { lat: pin.latitude, lng: pin.longitude }, approximate: false })
      } else {
        needsGeocode.push(pin)
      }
    }

    setResolved(withCoords)
    setUnpinned([])
    if (needsGeocode.length === 0) {
      setResolving(false)
      return
    }

    setResolving(true)
    void (async () => {
      const geocoded: ResolvedPin[] = []
      const failed: string[] = []
      for (const pin of needsGeocode) {
        if (cancelled) return
        const hit = await Promise.race([
          geocodeTireAddress({
            neighborhood: pin.neighborhood,
            street: pin.street,
            streetNo: pin.streetNo,
            openAddress: pin.openAddress,
            districtName: mapView.districtName,
          }),
          new Promise<null>(resolve => window.setTimeout(() => resolve(null), 4000)),
        ])
        if (hit) {
          geocoded.push({ ...pin, position: hit.position, approximate: hit.precision === 'approximate' })
        } else {
          geocoded.push({ ...pin, position: fallback, approximate: true })
          failed.push(pin.title)
        }
        if (!cancelled) {
          setResolved([...withCoords, ...geocoded])
          setUnpinned(failed)
        }
      }
      if (!cancelled) {
        setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtName, mapView.center, geocodeReady])

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

  const openJobDetail = useCallback(async (jobId: string) => {
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
  }, [t])
  const openJobDetailRef = useRef(openJobDetail)
  openJobDetailRef.current = openJobDetail

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
      marker.addListener('click', () => {
        void openJobDetailRef.current(pin.jobId)
      })
      return marker
    })
    markersRef.current = markers

    clustererRef.current = new CitizenMapClusterer({
      map: mapInstance,
      markers,
      algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 16 }),
      renderer: bannerClusterRenderer,
      onClusterClick: onCitizenClusterClick,
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

  function closeJobDetail() {
    setJobDetail(null)
    setCitizenSourceMessage(null)
    setDetailError(null)
    setDetailLoading(false)
  }

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
        onMouseEnter={() => setGestureHandling('greedy')}
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
              draggableCursor: 'grab',
              draggingCursor: 'grabbing',
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              clickableIcons: false,
            }}
          />
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
              title={t('citizenRequestMap.detailTitle', 'Vatandaş Talebi')}
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
