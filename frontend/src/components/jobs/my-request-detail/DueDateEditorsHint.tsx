import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { JobDueDateChange } from '../../../types/platform'
import { formatDateTime } from './format'
import { Button } from '../../ui/button'

interface DueDateEditorsHintProps {
  changes: JobDueDateChange[]
  locale: string
}

export function DueDateEditorsHint({ changes, locale }: DueDateEditorsHintProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!changes.length) return null

  const latest = changes[0]
  const latestName = latest.actorDisplayName?.trim()
  if (!latestName && changes.length === 1) return null

  if (changes.length === 1 && latestName) {
    return (
      <span className="font-semibold text-[#f97316]">
        {' '}({latestName})
      </span>
    )
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ml-1 h-auto px-1 py-0 text-xs font-bold text-[#f97316] underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        {t('jobs.dueDate.editorsButton', 'Düzenleyenler')}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <section
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-extrabold text-slate-950">
              {t('jobs.dueDate.editorsTitle', 'Son tarihi düzenleyenler')}
            </h3>
            <ul className="space-y-2 text-sm">
              {changes.map((row, index) => (
                <li key={`${row.changedAtUtc}-${index}`} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
                  <span className="font-semibold text-[#f97316]">{row.actorDisplayName?.trim() || t('common.unknown', 'Bilinmiyor')}</span>
                  <span className="tabular-nums text-slate-600">{formatDateTime(row.changedAtUtc, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
                {t('common.close', 'Kapat')}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
