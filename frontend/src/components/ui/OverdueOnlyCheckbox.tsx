import { useTranslation } from 'react-i18next'

export function OverdueOnlyCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <label className="ml-1 inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-700">
      <input
        type="checkbox"
        className="field-checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      {t('jobs.detail.wasOverdue', 'Gecikti mi?')}
    </label>
  )
}
