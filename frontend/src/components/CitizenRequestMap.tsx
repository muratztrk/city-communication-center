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
import { MapPinnedRequestsModal } from './MapPinnedRequestsModal'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { formatOverdueInProgressStatus } from '../utils/localization'
import { isJobDueDateOverdue } from '../utils/dateTimePicker'
import { getLocale } from '../utils/localization'
import { geocodeTireAddress, type LatLng } from '../utils/geocodeTireAddress'
import { isAbsentStreetNo } from '../utils/addressLimits'
import { getDistrictMapView } from '../data/izmir-district-maps'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from '../utils/googleMaps'
import { printJobDetail } from '../pages/JobsPage'

type ResolvedPin = CitizenDashboardMapPin & { position: LatLng; approximate: boolean }

const PIN_COLORS: Record<string, string> = {
  processingReceived: '#0d9488',
  pendingApproval: '#0ea5e9',
  inProgress: '#0ea5e9',
  overdue: '#f97316',
  completed: '#22c55e',
}

const DEPARTMENT_PIN_COLORS: Record<string, string> = {
  ...PIN_COLORS,
  pendingApproval: '#0ea5e9',
  inProgress: '#0ea5e9',
  overdue: '#f97316',
}

function pinColor(displayStatus: string, variant: 'citizen' | 'department'): string {
  const palette = variant === 'department' ? DEPARTMENT_PIN_COLORS : PIN_COLORS
  return palette[displayStatus] ?? palette.inProgress
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

let lastClusterClickKey = ''
let lastClusterClickCount = 0

function clusterMemberKey(cluster: Cluster): string {
  return cluster.markers
    .map(marker => {
      const position = MarkerUtils.getPosition(marker)
      if (!position) return ''
      const lat = typeof position.lat === 'function' ? position.lat() : position.lat
      const lng = typeof position.lng === 'function' ? position.lng() : position.lng
      return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`
    })
    .filter(Boolean)
    .sort()
    .join('|')
}

function isSameOrChildCluster(previousKey: string, nextKey: string): boolean {
  if (!previousKey || !nextKey) return false
  if (previousKey === nextKey) return true
  const previous = new Set(previousKey.split('|'))
  return nextKey.split('|').every(part => previous.has(part))
}

/** 2. tıklamada pinlere biraz daha yaklaş; fitBounds / sokak over-zoom yok (#2612). */
const CLUSTER_REVEAL_ZOOM = NUMBERED_SINGLE_MAX_ZOOM + 3
const INITIAL_MAP_ZOOM = 12

function onCitizenClusterClick(_: google.maps.MapMouseEvent, cluster: Cluster, map: google.maps.Map) {
  const current = map.getZoom() ?? 12
  map.panTo(cluster.position)
  const key = clusterMemberKey(cluster)
  lastClusterClickCount = isSameOrChildCluster(lastClusterClickKey, key)
    ? lastClusterClickCount + 1
    : 1
  lastClusterClickKey = key
  if (lastClusterClickCount >= 2) {
    if (current < CLUSTER_REVEAL_ZOOM) map.setZoom(CLUSTER_REVEAL_ZOOM)
    return
  }
  const next = Math.min(current + 1, CLUSTER_REVEAL_ZOOM)
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
  // Dış çerçeve yok (#2597); pin gövdesi durum rengi, iç daire beyaz (#2613).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 24 36">
    <path fill="${color}" fill-opacity="${fillOpacity}"
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

function hasCoordinates(pin: CitizenDashboardMapPin): boolean {
  return pin.latitude != null && pin.longitude != null
}

function hasCompleteCbsAddress(pin: CitizenDashboardMapPin): boolean {
  return Boolean(normalizeAddressPart(pin.neighborhood))
    && Boolean(normalizeAddressPart(pin.street))
    && Boolean(normalizeAddressPart(pin.streetNo))
    && !isAbsentStreetNo(pin.streetNo)
}

function hasMappableAddress(pin: CitizenDashboardMapPin, allowNeighborhood = false): boolean {
  // No=Yok ve koordinat yoksa pin yok; Haritada Olmayanlar listesine düşer (#2718).
  if (isAbsentStreetNo(pin.streetNo) && !hasCoordinates(pin)) return false
  if (hasCoordinates(pin)) return true
  if (hasCompleteCbsAddress(pin)) return true
  if (normalizeAddressPart(pin.street) && !isAbsentStreetNo(pin.streetNo)) return true
  if (allowNeighborhood && (normalizeAddressPart(pin.neighborhood) || normalizeAddressPart(pin.openAddress))) return true
  return false
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

function pinToTicket(pin: CitizenDashboardMapPin): CitizenConversationTicket {
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
    citizenName: pin.citizenName,
    citizenPhone: pin.citizenPhone,
    jobNumber: pin.jobNumber,
    jobNumberYear: pin.jobNumberYear,
    ownerDepartmentName: pin.ownerDepartmentName,
    destinationDepartmentName: pin.destinationDepartmentName,
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
  if (isJobDueDateOverdue({ status: detail.status, dueDateUtc: detail.dueDateUtc })) {
    return formatOverdueInProgressStatus(t)
  }
  if (detail.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  if (detail.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (detail.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
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
  variant?: 'citizen' | 'department'
  heading?: string
}

const MAP_CONTAINER_STYLE: CSSProperties = { width: '100%', height: '100%', cursor: 'grab' }

export function CitizenRequestMap({ pins, loading, variant = 'citizen', heading }: CitizenRequestMapProps) {
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
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const [streetViewPicker, setStreetViewPicker] = useState(false)
  const [listMode, setListMode] = useState<'located' | 'unlocated' | null>(null)
  const streetViewPickerRef = useRef(false)
  const coverageLayerRef = useRef<google.maps.StreetViewCoverageLayer | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const bouncingMarkerRef = useRef<google.maps.Marker | null>(null)

  const stopMarkerBounce = useCallback(() => {
    bouncingMarkerRef.current?.setAnimation(null)
    bouncingMarkerRef.current = null
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const sync = () => {
      setCompactViewport(media.matches)
      if (media.matches) setGestureHandling('greedy')
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const geocodeReady = !mapsReady || loadError != null || isLoaded

  useEffect(() => {
    if (!geocodeReady) return
    let cancelled = false

    const allowNeighborhood = variant === 'department'
    const mappable = pins.filter(pin => hasMappableAddress(pin, allowNeighborhood))
    if (mappable.length === 0) {
      setResolved([])
      setResolving(false)
      return
    }

    setResolving(true)
    void (async () => {
      const geocoded = (await Promise.all(mappable.map(async pin => {
        const useCoordinatePin = hasCoordinates(pin)
          && (isAbsentStreetNo(pin.streetNo)
            || (!normalizeAddressPart(pin.neighborhood) && !normalizeAddressPart(pin.street)))
        if (useCoordinatePin) {
          return {
            ...pin,
            position: { lat: pin.latitude as number, lng: pin.longitude as number },
            approximate: true,
          } satisfies ResolvedPin
        }

        const hit = await geocodeTireAddress({
          districtId: mapView.districtId,
          neighborhood: pin.neighborhood,
          street: pin.street,
          streetNo: pin.streetNo,
          allowNeighborhoodFallback: allowNeighborhood,
        })
        if (hit) {
          const hasStreetNo = Boolean(pin.streetNo?.trim()) && !isAbsentStreetNo(pin.streetNo)
          const position = !hasStreetNo || hit.precision === 'approximate'
            ? emptyAreaOffset(hit.position, pin.jobId)
            : hit.position
          return {
            ...pin,
            position,
            approximate: !hasStreetNo || hit.precision === 'approximate',
          } satisfies ResolvedPin
        }
        // Mahalle+Cadde+No doluysa Konum Koordinatı pin’e girmez (#2720).
        if (!hasCompleteCbsAddress(pin) && pin.latitude != null && pin.longitude != null) {
          return {
            ...pin,
            position: { lat: pin.latitude, lng: pin.longitude },
            approximate: true,
          } satisfies ResolvedPin
        }
        return null
      }))).filter((pin): pin is ResolvedPin => pin != null)
      if (!cancelled) {
        setResolved(geocoded)
        setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtId, geocodeReady, variant])

  const filledFromCoordinatesRef = useRef(new Set<string>())
  useEffect(() => {
    const districtId = mapView.districtId
    if (!districtId) return
    const pending = pins.filter(pin =>
      hasCoordinates(pin)
      && !normalizeAddressPart(pin.neighborhood)
      && !normalizeAddressPart(pin.street)
      && !filledFromCoordinatesRef.current.has(pin.jobId))
    if (pending.length === 0) return
    let cancelled = false
    void (async () => {
      for (const pin of pending.slice(0, 4)) {
        if (cancelled) return
        filledFromCoordinatesRef.current.add(pin.jobId)
        try {
          await api.fillJobCbsAddressFromCoordinates(pin.jobId, districtId)
        } catch {
          /* CBS eşleşmezse sessiz; tekrar deneme döngüsü olmasın. */
        }
      }
    })()
    return () => { cancelled = true }
  }, [pins, mapView.districtId])

  const unlocated = useMemo(() => {
    const locatedIds = new Set(resolved.map(pin => pin.jobId))
    return pins.filter(pin => !locatedIds.has(pin.jobId))
  }, [pins, resolved])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    mapInstance.setCenter({ lat: mapView.center.lat, lng: mapView.center.lng })
    mapInstance.setZoom(INITIAL_MAP_ZOOM)
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

  const focusPinOnMap = useCallback((jobId: string) => {
    setListMode(null)
    const index = resolvedRef.current.findIndex(pin => pin.jobId === jobId)
    const pin = index >= 0 ? resolvedRef.current[index] : null
    if (!pin || !mapInstance) return
    mapInstance.panTo(pin.position)
    const currentZoom = mapInstance.getZoom() ?? 12
    if (currentZoom < CLUSTER_REVEAL_ZOOM) mapInstance.setZoom(CLUSTER_REVEAL_ZOOM)
    const marker = markersRef.current[index]
    if (!marker) return
    stopMarkerBounce()
    marker.setAnimation(google.maps.Animation.BOUNCE)
    bouncingMarkerRef.current = marker
  }, [mapInstance, stopMarkerBounce])

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
        icon: pinSvgIcon(pinColor(pin.displayStatus, variant), pin.approximate),
      })
      marker.addListener('click', () => {
        stopMarkerBounce()
        openPinGroupRef.current(pin)
      })
      return marker
    })
    markersRef.current = markers

    clustererRef.current = new CitizenMapClusterer({
      map: mapInstance,
      markers,
      algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: NUMBERED_SINGLE_MAX_ZOOM }),
      renderer: bannerClusterRenderer,
      onClusterClick: (event, cluster, map) => {
        bouncingMarkerRef.current?.setAnimation(null)
        bouncingMarkerRef.current = null
        onCitizenClusterClick(event, cluster, map)
      },
    })

    return () => {
      bouncingMarkerRef.current = null
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      markersRef.current.forEach(marker => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, resolved, variant, stopMarkerBounce])

  const statusLegend = useMemo(() => {
    const inProgressColor = variant === 'department' ? DEPARTMENT_PIN_COLORS.inProgress : PIN_COLORS.inProgress
    const overdueColor = variant === 'department' ? DEPARTMENT_PIN_COLORS.overdue : PIN_COLORS.overdue
    const inProgressLabel = t('jobs.statusLabel.inProgress', 'Yapılmakta')
    const overdueLabel = t('citizenRequestMap.legend.overdue', 'Geciken')
    const items = [
      { key: 'inProgress', label: inProgressLabel, color: inProgressColor },
      {
        key: 'overdue',
        label: `${inProgressLabel} ${overdueLabel}`,
        color: overdueColor,
      },
      { key: 'completed', label: t('citizenRequestMap.legend.completed', 'Tamamlanan'), color: PIN_COLORS.completed },
    ]
    if (variant === 'department') return items
    return [
      { key: 'processingReceived', label: t('dashboard.chart.citizenProcessingReceived', 'İşleme Alındı'), color: PIN_COLORS.processingReceived },
      ...items,
    ]
  }, [t, variant])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map)
  }, [])

  const resetMapView = useCallback(() => {
    if (!mapInstance) return
    mapInstance.panTo({ lat: mapView.center.lat, lng: mapView.center.lng })
    mapInstance.setZoom(INITIAL_MAP_ZOOM)
  }, [mapInstance, mapView.center.lat, mapView.center.lng])

  useEffect(() => {
    if (!mapInstance) return
    const coverage = new google.maps.StreetViewCoverageLayer()
    coverageLayerRef.current = coverage
    const clickListener = mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
      stopMarkerBounce()
      if (!streetViewPickerRef.current || !event.latLng) return
      const service = new google.maps.StreetViewService()
      void service.getPanorama(
        { location: event.latLng, radius: 80, source: google.maps.StreetViewSource.OUTDOOR },
        (data, status) => {
          if (status !== google.maps.StreetViewStatus.OK || !data?.location?.latLng) return
          const panorama = mapInstance.getStreetView()
          panorama.setPosition(data.location.latLng)
          panorama.setPov({ heading: 0, pitch: 0 })
          panorama.setVisible(true)
          coverage.setMap(null)
          streetViewPickerRef.current = false
          setStreetViewPicker(false)
        },
      )
    })
    const panorama = mapInstance.getStreetView()
    const visibleListener = panorama.addListener('visible_changed', () => {
      if (panorama.getVisible()) return
      coverage.setMap(null)
      streetViewPickerRef.current = false
      setStreetViewPicker(false)
    })
    return () => {
      google.maps.event.removeListener(clickListener)
      google.maps.event.removeListener(visibleListener)
      coverage.setMap(null)
      coverageLayerRef.current = null
    }
  }, [mapInstance, stopMarkerBounce])

  function toggleStreetViewPicker() {
    if (!mapInstance) return
    const panorama = mapInstance.getStreetView()
    if (panorama.getVisible()) {
      panorama.setVisible(false)
      coverageLayerRef.current?.setMap(null)
      streetViewPickerRef.current = false
      setStreetViewPicker(false)
      return
    }
    const next = !streetViewPickerRef.current
    streetViewPickerRef.current = next
    setStreetViewPicker(next)
    coverageLayerRef.current?.setMap(next ? mapInstance : null)
  }

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
          <div className="text-sm font-bold text-slate-800">
            {heading ?? t('nav.social', 'Vatandaş Talepleri')}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
          {statusLegend.map(item => (
            <span
              key={item.key}
              className={`inline-flex shrink-0 items-center gap-1.5${item.key === 'overdue' ? ' whitespace-nowrap' : ''}`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
          <span className="text-slate-400">
            {loading || resolving
              ? t('common.loading', 'Yükleniyor...')
              : t('citizenRequestMap.pinCount', { count: resolved.length, defaultValue: '{{count}} konum' })}
          </span>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 max-lg:w-full">
          <button
            type="button"
            disabled={loading || resolving || resolved.length === 0}
            onClick={() => setListMode('located')}
            className="whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-50 max-lg:min-h-[2.15rem] max-lg:min-w-[8.25rem] max-lg:flex-1 max-lg:px-2 max-lg:py-1.5 max-lg:text-[11px]"
          >
            {t('citizenRequestMap.listRequests', 'Talepleri Listele')}
          </button>
          <button
            type="button"
            disabled={loading || resolving || unlocated.length === 0}
            onClick={() => setListMode('unlocated')}
            className="whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-50 max-lg:min-h-[2.15rem] max-lg:min-w-[8.25rem] max-lg:flex-1 max-lg:px-2 max-lg:py-1.5 max-lg:text-[11px]"
          >
            {t('citizenRequestMap.listUnlocated', 'Haritada Olmayanları Listele')}
          </button>
          </div>
          </div>
        </div>
      </div>

      <div
        className="relative h-[min(36rem,65vh)] w-full bg-slate-100"
        onMouseEnter={() => {
          if (!compactViewport) setGestureHandling('greedy')
        }}
        onMouseLeave={() => {
          if (!compactViewport) setGestureHandling('none')
        }}
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
            mapContainerClassName="citizen-request-map"
            center={mapCenter}
            zoom={INITIAL_MAP_ZOOM}
            onLoad={onMapLoad}
            onClick={() => setGestureHandling('greedy')}
            options={{
              gestureHandling,
              draggableCursor: 'grab',
              draggingCursor: 'grabbing',
              cameraControl: false,
              zoomControl: false,
              streetViewControl: false,
              rotateControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              clickableIcons: false,
            }}
          />
        )}
        {mapsReady && isLoaded && !loadError ? (
          <div
            className="citizen-request-map-controls"
            onClick={event => event.stopPropagation()}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className={`citizen-request-map-streetview-btn${streetViewPicker ? ' is-active' : ''}`}
              title={t('citizenRequestMap.streetView', 'Street View')}
              aria-label={t('citizenRequestMap.streetView', 'Street View')}
              aria-pressed={streetViewPicker}
              onClick={toggleStreetViewPicker}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <circle cx="12" cy="5.6" r="2.55" fill="#F4B400" />
                <path
                  fill="#F4B400"
                  d="M7.9 9.15c0-.5.4-.9.9-.9h6.4c.5 0 .9.4.9.9v4.15l1.35.45c.28.1.45.4.38.68l-.2.78a.6.6 0 0 1-.73.42L15.15 15.1v5.05c0 .42-.34.75-.75.75h-.7c-.41 0-.75-.33-.75-.75v-3.05h-.4v3.05c0 .42-.34.75-.75.75h-.7c-.41 0-.75-.33-.75-.75V15.1l-1.75.53a.6.6 0 0 1-.73-.42l-.2-.78a.58.58 0 0 1 .38-.68l1.35-.45V9.15z"
                />
                <path fill="#E37400" opacity=".35" d="M12.9 8.25h2.3c.5 0 .9.4.9.9v4.15l1.35.45.2.78-.2.1-1.55-.48V15.1v5.05c0 .2-.08.38-.2.5h-.7V17.1h-.4v3.55h-.7c-.12-.12-.2-.3-.2-.5v-3.05h-.1V8.25z" />
              </svg>
            </button>
            <div className="citizen-request-map-zoom-stack">
              <button
                type="button"
                className="citizen-request-map-zoom-btn citizen-request-map-reset-btn"
                title={t('citizenRequestMap.resetView', 'Başlangıç görünümü')}
                aria-label={t('citizenRequestMap.resetView', 'Başlangıç görünümü')}
                onClick={resetMapView}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="2.15" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="6.1" />
                  <path d="M12 2.6v2.7M12 18.7v2.7M2.6 12h2.7M18.7 12h2.7" strokeLinecap="round" />
                </svg>
              </button>
              <div className="citizen-request-map-zoom">
              <button
                type="button"
                className="citizen-request-map-zoom-btn"
                title="+"
                aria-label="+"
                onClick={() => {
                  if (!mapInstance) return
                  mapInstance.setZoom(Math.min(21, (mapInstance.getZoom() ?? INITIAL_MAP_ZOOM) + 1))
                }}
              >
                +
              </button>
              <button
                type="button"
                className="citizen-request-map-zoom-btn"
                title="−"
                aria-label="−"
                onClick={() => {
                  if (!mapInstance) return
                  mapInstance.setZoom(Math.max(3, (mapInstance.getZoom() ?? INITIAL_MAP_ZOOM) - 1))
                }}
              >
                −
              </button>
              </div>
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
          replaceUnitWithCitizenContact={variant === 'citizen'}
          layout={variant === 'department' ? 'departmentMap' : 'directory'}
        />
      ) : null}

      {listMode ? (
        <MapPinnedRequestsModal
          pins={listMode === 'located' ? resolved : unlocated}
          variant={variant}
          located={listMode === 'located'}
          onClose={() => setListMode(null)}
          onOpenJob={(jobId, socialMessageId) => void openJobDetail(jobId, socialMessageId)}
          onShowOnMap={focusPinOnMap}
        />
      ) : null}

      {(jobDetail || detailLoading || detailError) ? createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {jobDetail ? (
            <MyRequestDetailModal
              detail={jobDetail}
              title={variant === 'department'
                ? t('departmentRequestMap.detailTitle', 'Talep')
                : addressTickets
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
              onPrint={() => printJobDetail(jobDetail, locale, t, {
                myRequestView: true,
                requestLabel: citizenSourceMessage?.category,
                sourceChannel: citizenSourceMessage?.channel,
              })}
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
