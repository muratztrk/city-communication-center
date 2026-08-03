import { useEffect, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { clearLicenseModules, saveLicenseModules } from '../lib/licenseModules'
import { useAuth } from './AuthContext'

/**
 * Lisans modül durumunu login sonrası çeker ve `lib/licenseModules.ts`'e (rolePageAccess.ts'teki
 * rol-yetki matrisiyle aynı localStorage-senkron desen) yansıtır — böylece `canAnyRoleAccessPage`
 * gibi React dışı saf fonksiyonlar senkron okuyabilir. Ayrı bir context/hook gerekmiyor: veri
 * ilk geldiğinde bu bileşen yeniden render olur, altındaki ağaç (AppShell, route'lar) da onunla
 * birlikte yeniden render edilip güncel modül durumunu görür.
 */
export function LicenseModuleSync({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth()

  const { data } = useQuery({
    queryKey: queryKeys.licensing.modules(),
    queryFn: () => api.getLicenseModules(),
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (!isAuthenticated) {
      clearLicenseModules()
      return
    }
    if (data) {
      saveLicenseModules(data)
    }
  }, [isAuthenticated, data])

  return children
}
