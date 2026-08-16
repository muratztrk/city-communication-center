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
  coordinates?: string | null
}

export function CitizenAddressPeekButton({
  neighborhood,
  street,
  streetNo,
  openAddress,
  coordinates,
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
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="citizen-address-peek-title"
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
                id="citizen-address-peek-title"
                className="mb-3 border-b border-slate-200 pb-3 pr-8 text-base font-bold text-slate-950"
              >
                {t('jobs.detail.citizenAddressInfo', 'Vatandaş Adres Bilgisi')}
              </h2>
              <AddressDetailFields
                variant="peek"
                neighborhood={neighborhood}
                street={street}
                streetNo={streetNo}
                openAddress={openAddress}
                coordinates={coordinates}
              />
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
