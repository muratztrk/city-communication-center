import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X as XIcon } from 'lucide-react'
import { Button } from '../../ui/button'

type CoordinatesPeekButtonProps = {
  value: string
}

export function CoordinatesPeekButton({ value }: CoordinatesPeekButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const trimmed = value.trim()
  if (!trimmed) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 px-2.5 text-[11px]"
        onClick={() => setOpen(true)}
      >
        {t('jobs.detail.viewCoordinates', 'Konumu Gör')}
      </Button>
      {open
        ? createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="coordinates-peek-title"
              onClick={event => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close', 'Kapat')}
                className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <XIcon className="size-4" />
              </button>
              <h2
                id="coordinates-peek-title"
                className="mb-3 border-b border-slate-200 pb-3 pr-8 text-base font-bold text-slate-950"
              >
                {t('address.coordinatesLabel', 'Konum Linki')}
              </h2>
              <p className="break-all text-sm text-slate-800">{trimmed}</p>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
