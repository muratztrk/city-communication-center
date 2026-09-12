import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { COUNTRY_CALLING_CODES, countryFlagEmoji } from '../../utils/countryCallingCodes'
import { SingleSelectDropdown } from './single-select-dropdown'

interface CountryCallingCodeSelectProps {
  value: string
  onChange: (iso: string) => void
  className?: string
}

export function CountryCallingCodeSelect({ value, onChange, className }: CountryCallingCodeSelectProps) {
  const { i18n, t } = useTranslation()
  const isTr = i18n.language.toLocaleLowerCase('tr').startsWith('tr')
  const options = useMemo(() => {
    const named = COUNTRY_CALLING_CODES.map(country => {
      const name = isTr ? country.nameTr : country.nameEn
      const flag = countryFlagEmoji(country.iso)
      return {
        value: country.iso,
        label: `${flag} ${name} +${country.dial}`,
        triggerLabel: `${flag} +${country.dial}`,
      }
    })
    const turkey = named.filter(item => item.value === 'TR')
    const rest = named
      .filter(item => item.value !== 'TR')
      .sort((left, right) => left.label.localeCompare(right.label, isTr ? 'tr' : 'en'))
    return [...turkey, ...rest]
  }, [isTr])

  return (
    <SingleSelectDropdown
      searchable
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t('settings.citizen.citizenPhoneCountry', 'Ülke kodu')}
      searchPlaceholder={t('settings.citizen.citizenPhoneCountrySearch', 'Ülke ara...')}
      className={className}
      triggerClassName="h-[2.375rem] min-w-[7.25rem] px-2.5 text-[0.8125rem]"
      menuWidth={320}
      menuExpand="right"
    />
  )
}
