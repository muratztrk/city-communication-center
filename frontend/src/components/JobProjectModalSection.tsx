import type { TFunction } from 'i18next'

export function JobProjectConfirmationPrompt({
  t,
  name,
  decision,
  onDecisionChange,
}: {
  t: TFunction
  name: string
  decision: boolean | null
  onDecisionChange: (value: boolean) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <p className="text-sm font-semibold text-orange-500">
        {t('jobs.projectConfirmationPrompt', 'Talebin proje niteliğinde olduğunu onaylıyor musunuz?')}
        <span className="text-red-600">*</span>
      </p>
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
          <input
            type="radio"
            name={name}
            className="size-4"
            checked={decision === true}
            onChange={() => onDecisionChange(true)}
          />
          <span className="text-sm text-slate-800">{t('common.yes', 'Evet')}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
          <input
            type="radio"
            name={name}
            className="size-4"
            checked={decision === false}
            onChange={() => onDecisionChange(false)}
          />
          <span className="text-sm text-slate-800">{t('common.no', 'Hayır')}</span>
        </label>
      </div>
    </div>
  )
}

export function JobProjectDeclaredNotice({ t }: { t: TFunction }) {
  return (
    <p className="mb-4 text-sm font-semibold text-orange-500">
      {t('jobs.projectDeclaredNotice', 'Talep proje niteliğindedir.')}
    </p>
  )
}
