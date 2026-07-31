import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { ModalBackdrop } from './modal-backdrop'
import { SESSION_SUPERSEDED_EVENT } from '../../api/http'

interface SessionSupersededWarningProps {
  onLogout: () => void
}

/** Aynı kullanıcı başka yerden login olunca önceki oturumda uyarı (#6a6c805e). */
export function SessionSupersededWarning({ onLogout }: SessionSupersededWarningProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleSuperseded = () => setIsOpen(true)
    window.addEventListener(SESSION_SUPERSEDED_EVENT, handleSuperseded)
    return () => window.removeEventListener(SESSION_SUPERSEDED_EVENT, handleSuperseded)
  }, [])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <ModalBackdrop>
      <div className="relative w-full max-w-md rounded-[var(--radius-2xl)] bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-950">
          {t('sessionSuperseded.title', 'Oturumunuz Sonlandırıldı')}
        </h2>
        <p className="mt-3 text-sm text-slate-700">
          {t(
            'sessionSuperseded.message',
            'Bu hesap başka bir oturumda giriş yaptığı için mevcut oturumunuz kapatıldı. Devam etmek için tekrar giriş yapın.',
          )}
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setIsOpen(false)
              onLogout()
            }}
          >
            {t('sessionSuperseded.confirm', 'Tamam')}
          </Button>
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  )
}
