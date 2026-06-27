import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/button'

export function PwaRefreshPrompt() {
  const { t } = useTranslation()
  const location = useLocation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        void registration.update()
      }
    },
  })

  useEffect(() => {
    if (import.meta.env.DEV) return
    const intervalId = window.setInterval(() => {
      void navigator.serviceWorker?.getRegistration().then(registration => {
        void registration?.update()
      })
    }, 5 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV || !needRefresh) return
    void updateServiceWorker(true)
    window.location.reload()
  }, [needRefresh, updateServiceWorker])

  if (import.meta.env.DEV || !needRefresh || location.pathname === '/login') {
    return null
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-[1.4rem] bg-slate-950/92 px-5 py-4 text-white shadow-2xl backdrop-blur md:inset-x-auto md:right-6 md:w-[26rem]">
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">PWA</div>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {t('pwa.updateReady')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            {t('pwa.reload')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setNeedRefresh(false)
            }}
          >
            {t('pwa.dismiss')}
          </Button>
        </div>
      </div>
    </div>
  )
}
