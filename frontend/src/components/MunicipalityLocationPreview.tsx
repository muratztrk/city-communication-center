import { useMemo } from 'react'
import { getNeighborhoodsForDistrict, getDistrictName } from '../data/izmir-locations'

/** Ayarlar → Kurum Konumu: seçili ilçeye göre mahalle listesi önizlemesi (#r512 / #r514 — harita Anasayfa’da). */
export function MunicipalityLocationPreview({ districtId }: { districtId: string }) {
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const districtName = getDistrictName(districtId)

  return (
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
  )
}
