import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import type { CitizenDashboardMapPin, JobDetail, SocialMessage } from '../types/platform'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { geocodeTireAddress, TIRE_MAP_BOUNDS, TIRE_MAP_CENTER, type LatLng } from '../utils/geocodeTireAddress'

type ResolvedPin = CitizenDashboardMapPin & { position: LatLng }

function pinColor(displayStatus: string): string {
  return displayStatus === 'inProgress' ? '#22c55e' : '#0ea5e9'
}

function FitPins({ pins }: { pins: ResolvedPin[] }) {
  const map = useMap()
  useEffect(() => {
    const districtBounds = L.latLngBounds(TIRE_MAP_BOUNDS)
    if (pins.length === 0) {
      // Varsayılan daha yakın zoom (card #1867 reopen).
      map.fitBounds(districtBounds, { padding: [16, 16], maxZoom: 14 })
      return
    }
    if (pins.length === 1) {
      map.setView([pins[0].position.lat, pins[0].position.lng], 16)
      return
    }
    const pinBounds = L.latLngBounds(pins.map(pin => [pin.position.lat, pin.position.lng] as [number, number]))
    map.fitBounds(districtBounds.extend(pinBounds), { padding: [24, 24], maxZoom: 15 })
  }, [map, pins])
  return null
}

/** Haritaya tıklanmadan scroll-zoom kapalı — sayfa kaydırırken zoom olmasın (card #1867). */
function RequireClickForScrollZoom() {
  const map = useMap()
  useEffect(() => {
    map.scrollWheelZoom.disable()
    const container = map.getContainer()
    const enable = () => { map.scrollWheelZoom.enable() }
    const disable = () => { map.scrollWheelZoom.disable() }
    container.addEventListener('click', enable)
    container.addEventListener('mouseleave', disable)
    return () => {
      container.removeEventListener('click', enable)
      container.removeEventListener('mouseleave', disable)
      map.scrollWheelZoom.disable()
    }
  }, [map])
  return null
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

/**
 * Kontrol Paneli Vatandaş — Tire haritasında açık adresli İşleme Alındı / Yapılmakta pinleri (card #1834).
 */
export function CitizenDashboardMap({ pins, loading }: CitizenDashboardMapProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [resolved, setResolved] = useState<ResolvedPin[]>([])
  const [resolving, setResolving] = useState(false)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [pins])

  const statusLegend = useMemo(() => ([
    { key: 'processingReceived', label: t('dashboard.chart.citizenProcessingReceived', 'İşleme Alındı') },
    { key: 'inProgress', label: t('dashboard.chart.inProgress', 'Yapılmakta Olan') },
  ]), [t])

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

  return (
    <section className="section-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-slate-800 sm:text-lg">
            {t('dashboard.citizenMap.title', 'Tire Haritası - Açık Adresli Talepler')}
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

      <div className="relative h-[min(28rem,55vh)] w-full bg-slate-100">
        <MapContainer
          center={[TIRE_MAP_CENTER.lat, TIRE_MAP_CENTER.lng]}
          zoom={14}
          className="size-full z-0"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RequireClickForScrollZoom />
          <FitPins pins={resolved} />
          {resolved.map(pin => (
            <CircleMarker
              key={pin.jobId}
              center={[pin.position.lat, pin.position.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: pinColor(pin.displayStatus),
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <button
                  type="button"
                  className="max-w-[16rem] cursor-pointer text-left text-sm font-semibold text-[color:var(--color-primary)] underline-offset-2 hover:underline"
                  onClick={() => void openJobDetail(pin.jobId)}
                >
                  {pin.title}
                </button>
                {pin.openAddress ? (
                  <div className="mt-1 text-[11px] leading-snug text-slate-500">{pin.openAddress}</div>
                ) : null}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
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
