import { CheckCircle2, KeyRound, Loader2, Mail, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { Button } from '../ui/button'

interface LoginPasswordResetModalProps {
  tenantId: string
  onClose: () => void
}

export function LoginPasswordResetModal({ tenantId, onClose }: LoginPasswordResetModalProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    setError(null)
    if (!email.trim()) {
      setError(t('passwordReset.errors.emailRequired', 'Lütfen e-posta adresinizi girin.'))
      return
    }
    if (!tenantId) {
      setError(t('login.tenantRequired', 'Lütfen bir belediye seçin.'))
      return
    }
    setSubmitting(true)
    try {
      await api.resetLocalUserPassword({ tenantId, email: email.trim() })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('passwordReset.errors.failed', 'Parola sıfırlanamadı.'))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary,var(--color-primary))] px-6 py-4">
          <KeyRound className="size-5 shrink-0 text-white/80" />
          <h2 className="flex-1 text-base font-extrabold text-white">
            {t('passwordReset.title', 'Local Kullanıcı Parola Sıfırla')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
            aria-label={t('common.close', 'Kapat')}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 className="size-12 text-[color:var(--color-success)]" />
            <p className="text-sm font-semibold text-slate-700">
              {t('passwordReset.success', 'Yeni parolanız e-posta adresinize gönderildi.')}
            </p>
            <Button type="button" variant="success" onClick={onClose}>
              {t('common.close', 'Kapat')}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 px-6 py-5"
            onSubmit={event => { event.preventDefault(); void handleSubmit() }}
          >
            <p className="text-sm leading-6 text-slate-600">
              {t('passwordReset.description', 'Kayıtlı e-posta adresinizi girin. Yerel kullanıcıysanız yeni parolanız e-postanıza gönderilir.')}
            </p>
            <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                {t('passwordReset.email', 'E-posta')}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-email"
                  type="email"
                  className="field-input w-full pl-9"
                  value={email}
                  autoFocus
                  autoComplete="email"
                  onChange={event => setEmail(event.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* Footer: green "Parola Sıfırla" button bottom-right */}
            <div className="mt-1 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                {t('common.cancel', 'Vazgeç')}
              </Button>
              <Button type="submit" variant="success" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t('passwordReset.submit', 'Parola Sıfırla')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
