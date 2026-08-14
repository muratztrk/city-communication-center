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
import type { CitizenConversationTicket, CitizenDashboardMapPin, JobDetail, SocialMessage } from '../types/platform'
import { CitizenDirectoryTicketsModal } from './citizen-directory/CitizenDirectoryTicketsModal'
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

function clusterPixelSize(count: number): number {
  return count < 10 ? 32 : count < 50 ? 38 : 44
}

function clusterSvgIcon(count: number, color: string): google.maps.Icon {
  const size = clusterPixelSize(count)
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
    const size = clusterPixelSize(count)
    return new google.maps.Marker({
      position,
      icon: clusterSvgIcon(count, color),
      label: {
        text: String(count),
        color: '#ffffff',
        fontSize: size >= 38 ? '12px' : '11px',
        fontWeight: '700',
      },
      zIndex: 1000 + count,
    })
  },
}

function onCitizenClusterClick(_: google.maps.MapMouseEvent, cluster: Cluster, map: google.maps.Map) {
  const current = map.getZoom() ?? 12
  map.panTo(cluster.position)
  const next = Math.min(current + 1, 18)
  if (next > current) map.setZoom(next)
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

const PIN_WIDTH = 18
const PIN_HEIGHT = 27

function pinSvgIcon(color: string, approximate: boolean): google.maps.Icon {
  const cacheKey = `${color}|${approximate ? 'approx' : 'exact'}`
  const cached = pinIconCache.get(cacheKey)
  if (cached) return cached
  const fillOpacity = approximate ? '0.72' : '1'
  const dash = approximate ? 'stroke-dasharray="3 2"' : ''
  // Pin rengi durum rengi; arka plan çerçevesi detay popup ikon kutusu (#2597).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 24 36">
    <rect x="1.2" y="0.5" width="21.6" height="19.4" rx="5.5" fill="#f1f5f9"/>
    <path fill="${color}" fill-opacity="${fillOpacity}" stroke="#ffffff" stroke-width="1.6" ${dash}
      d="M12 1.2C6.7 1.2 2.4 5.5 2.4 10.8c0 7.4 9.6 23 9.6 23s9.6-15.6 9.6-23C21.6 5.5 17.3 1.2 12 1.2z"/>
    <circle cx="12" cy="11" r="3.6" fill="#ffffff"/>
  </svg>`
  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(PIN_WIDTH, PIN_HEIGHT),
    anchor: new google.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
  }
  pinIconCache.set(cacheKey, icon)
  return icon
}

function normalizeAddressPart(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('tr')
}

function pinAddressKey(pin: ResolvedPin): string | null {
  const neighborhood = normalizeAddressPart(pin.neighborhood)
  const street = normalizeAddressPart(pin.street)
  const streetNo = normalizeAddressPart(pin.streetNo)
  if (street && streetNo) return `addr|${neighborhood}|${street}|${streetNo}`
  return null
}

function hasMappableAddress(pin: CitizenDashboardMapPin): boolean {
  return Boolean(normalizeAddressPart(pin.neighborhood) || normalizeAddressPart(pin.street))
}

/** No yoksa cadde/mahalle noktasından boş alana kaydır — aynı cadde pinleri üst üste binmesin (#2594). */
function emptyAreaOffset(origin: LatLng, seed: string): LatLng {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180)
  const meters = 28 + ((hash >>> 0) % 18)
  const north = meters * Math.cos(angle)
  const east = meters * Math.sin(angle)
  const latRad = origin.lat * (Math.PI / 180)
  return {
    lat: origin.lat + north / 111_320,
    lng: origin.lng + east / (111_320 * Math.cos(latRad) || 111_320),
  }
}

function pinGeoKey(pin: ResolvedPin): string {
  return `${pin.position.lat.toFixed(5)}|${pin.position.lng.toFixed(5)}`
}

function pinsAtSamePlace(all: ResolvedPin[], clicked: ResolvedPin): ResolvedPin[] {
  const addressKey = pinAddressKey(clicked)
  const byAddress = addressKey
    ? all.filter(pin => pinAddressKey(pin) === addressKey)
    : []
  if (byAddress.length > 1) return byAddress
  if (clicked.approximate) return [clicked]
  const geoKey = pinGeoKey(clicked)
  const byGeo = all.filter(pin => !pin.approximate && pinGeoKey(pin) === geoKey)
  return byGeo.length > 1 ? byGeo : [clicked]
}

function pinToTicket(pin: ResolvedPin): CitizenConversationTicket {
  return {
    socialMessageId: pin.socialMessageId ?? pin.jobId,
    status: pin.jobStatus ?? 'Active',
    receivedAtUtc: pin.createdAtUtc ?? '',
    jobId: pin.jobId,
    category: null,
    citizenRequestNumber: pin.citizenRequestNumber,
    citizenRequestNumberYear: pin.citizenRequestNumberYear,
    priority: pin.priority,
    jobStatus: pin.jobStatus,
    departmentName: pin.departmentName,
    channel: pin.channel,
    title: pin.title,
    dueDateUtc: pin.dueDateUtc,
    completedAtUtc: pin.completedAtUtc,
    updatedAtUtc: pin.updatedAtUtc,
  }
}

function citizenFromPins(pins: ResolvedPin[]): { citizenName: string | null; citizenPhone: string } {
  const names = [...new Set(pins.map(pin => pin.citizenName?.trim()).filter((value): value is string => Boolean(value)))]
  const phones = [...new Set(pins.map(pin => pin.citizenPhone?.trim()).filter((value): value is string => Boolean(value)))]
  return {
    citizenName: names.length === 1 ? names[0] : names.length > 1 ? names.join(', ') : null,
    citizenPhone: phones.length === 1 ? phones[0] : '',
  }
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
  const mapCenter = useMemo(
    () => ({ lat: mapView.center.lat, lng: mapView.center.lng }),
    [mapView.center.lat, mapView.center.lng],
  )
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
  const [addressTickets, setAddressTickets] = useState<{
    citizen: { citizenName: string | null; citizenPhone: string }
    tickets: CitizenConversationTicket[]
  } | null>(null)
  const [gestureHandling, setGestureHandling] = useState<'none' | 'greedy'>('none')
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  const geocodeReady = !mapsReady || loadError != null || isLoaded

  useEffect(() => {
    if (!geocodeReady) return
    let cancelled = false

    const mappable = pins.filter(hasMappableAddress)
    if (mappable.length === 0) {
      setResolved([])
      setUnpinned([])
      setResolving(false)
      return
    }

    setResolved([])
    setUnpinned([])
    setResolving(true)
    void (async () => {
      const geocoded: ResolvedPin[] = []
      const failed: string[] = []
      for (const pin of mappable) {
        if (cancelled) return
        const hit = await Promise.race([
          geocodeTireAddress({
            neighborhood: pin.neighborhood,
            street: pin.street,
            streetNo: pin.streetNo,
            districtName: mapView.districtName,
          }),
          new Promise<null>(resolve => window.setTimeout(() => resolve(null), 4000)),
        ])
        if (hit) {
          const hasStreetNo = Boolean(pin.streetNo?.trim())
          const position = !hasStreetNo || hit.precision === 'approximate'
            ? emptyAreaOffset(hit.position, pin.jobId)
            : hit.position
          geocoded.push({
            ...pin,
            position,
            approximate: !hasStreetNo || hit.precision === 'approximate',
          })
        } else {
          failed.push(pin.title)
        }
        if (!cancelled) {
          setResolved([...geocoded])
          setUnpinned(failed)
        }
      }
      if (!cancelled) {
        setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtName, geocodeReady])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    mapInstance.setCenter({ lat: mapView.center.lat, lng: mapView.center.lng })
    mapInstance.setZoom(12)
  }, [mapInstance, isLoaded, mapView.center.lat, mapView.center.lng])

  const openJobDetail = useCallback(async (jobId: string, socialMessageId?: string) => {
    setJobDetail(null)
    setCitizenSourceMessage(null)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const [detail, sourceMessage] = await Promise.all([
        api.getJobById(jobId),
        socialMessageId
          ? api.getSocialMessageById(socialMessageId).catch(() => null)
          : Promise.resolve(null),
      ])
      setJobDetail(detail)
      setCitizenSourceMessage(sourceMessage ?? await loadCitizenSourceMessage(detail))
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }, [t])
  const openJobDetailRef = useRef(openJobDetail)
  openJobDetailRef.current = openJobDetail
  const resolvedRef = useRef(resolved)
  resolvedRef.current = resolved

  const openPinGroup = useCallback((clicked: ResolvedPin) => {
    const group = pinsAtSamePlace(resolvedRef.current, clicked)
    if (group.length > 1) {
      setJobDetail(null)
      setCitizenSourceMessage(null)
      setDetailError(null)
      setDetailLoading(false)
      setAddressTickets({
        citizen: citizenFromPins(group),
        tickets: group.map(pinToTicket),
      })
      return
    }
    setAddressTickets(null)
    void openJobDetailRef.current(clicked.jobId, clicked.socialMessageId ?? undefined)
  }, [])
  const openPinGroupRef = useRef(openPinGroup)
  openPinGroupRef.current = openPinGroup

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
        openPinGroupRef.current(pin)
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
            center={mapCenter}
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

      {addressTickets ? (
        <CitizenDirectoryTicketsModal
          key={addressTickets.tickets.map(ticket => ticket.jobId).join('|')}
          citizen={addressTickets.citizen}
          tickets={addressTickets.tickets}
          loading={false}
          error={null}
          locale={locale}
          jobDetailLoading={detailLoading}
          emptyMessage={t('citizenRequestMap.noTicketsAtAddress', 'Bu adreste talep bulunamadı.')}
          onClose={() => {
            setAddressTickets(null)
            closeJobDetail()
          }}
          onOpenJobDetail={(jobId, socialMessageId) => void openJobDetail(jobId, socialMessageId)}
        />
      ) : null}

      {(jobDetail || detailLoading || detailError) ? createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {jobDetail ? (
            <MyRequestDetailModal
              detail={jobDetail}
              title={addressTickets
                ? t('citizenDirectory.ticketsTitle', 'Vatandaş Talep Bilgisi')
                : t('citizenRequestMap.detailTitle', 'Vatandaş Talebi')}
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
              shellClassName={addressTickets ? 'detail-modal-shell--citizen-directory-nested' : undefined}
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
