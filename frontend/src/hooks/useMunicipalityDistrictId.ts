import { useEffect, useState } from 'react'
import {
  getSavedDistrictId,
  MUNICIPALITY_DISTRICT_CHANGED_EVENT,
  MUNICIPALITY_DISTRICT_KEY,
} from '../data/izmir-locations'

/** Kurum Konumu ilçesini dinler — kayıt / diğer sekme storage sonrası güncellenir (#r512). */
export function useMunicipalityDistrictId(): string {
  const [districtId, setDistrictId] = useState(getSavedDistrictId)

  useEffect(() => {
    const sync = () => setDistrictId(getSavedDistrictId())
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setDistrictId(typeof detail === 'string' && detail.trim() ? detail : getSavedDistrictId())
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === MUNICIPALITY_DISTRICT_KEY) sync()
    }
    window.addEventListener(MUNICIPALITY_DISTRICT_CHANGED_EVENT, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(MUNICIPALITY_DISTRICT_CHANGED_EVENT, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return districtId
}
