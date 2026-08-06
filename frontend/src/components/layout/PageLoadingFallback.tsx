import { useTranslation } from 'react-i18next'

/** Lightweight in-shell fallback while a lazy route chunk loads (keeps sidebar/header visible). */
export function PageLoadingFallback() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 items-center justify-center py-16" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/15 border-t-[color:var(--color-primary)]" />
        <p className="text-sm font-medium text-[color:var(--color-muted-foreground)]">{t('common.loading')}</p>
      </div>
    </div>
  )
}
