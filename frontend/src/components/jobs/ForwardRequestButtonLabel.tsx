import { useTranslation } from 'react-i18next'

/** Birime Gelen / iade detayında yönlendir butonu iki satır (#4206). */
export function ForwardRequestButtonLabel() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex flex-col items-center text-center leading-tight">
      <span>{t('jobs.actions.forwardDepartmentLine', 'Farklı Birime')}</span>
      <span>{t('jobs.actions.forward', 'Talebi Yönlendir')}</span>
    </span>
  )
}
