import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X as XIcon } from 'lucide-react'
import { AddressDetailFields } from '../../ui/AddressDetailFields'
import { Button } from '../../ui/button'

type CitizenAddressPeekButtonProps = {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
}

export function CitizenAddressPeekButton({
  neighborhood,
  street,
  streetNo,
  openAddress,
}: CitizenAddressPeekButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 px-2.5 text-[11px]"
        onClick={() => setOpen(true)}
      >
        {t('jobs.detail.viewAddress', 'Adresi Gör')}
      </Button>
      {open
        ? createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={t('jobs.detail.citizenAddressInfo', 'Vatandaş Adres Bilgisi')}
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-800">
                  {t('jobs.detail.citizenAddressInfo', 'Vatandaş Adres Bilgisi')}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <XIcon className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <AddressDetailFields
                variant="stacked"
                neighborhood={neighborhood}
                street={street}
                streetNo={streetNo}
                openAddress={openAddress}
              />
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
