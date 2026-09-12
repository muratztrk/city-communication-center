import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { COUNTRY_CALLING_CODES } from '../../utils/countryCallingCodes'
import { SingleSelectDropdown } from './single-select-dropdown'

interface CountryCallingCodeSelectProps {
  value: string
  onChange: (iso: string) => void
  className?: string
}

function CountryFlag({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${iso.toLowerCase()}.png`}
      alt=""
      width={20}
      height={15}
      className="inline-block shrink-0 rounded-[1px] object-cover"
      loading="lazy"
      decoding="async"
    />
  )
}

export function CountryCallingCodeSelect({ value, onChange, className }: CountryCallingCodeSelectProps) {
  const { i18n, t } = useTranslation()
  const isTr = i18n.language.toLocaleLowerCase('tr').startsWith('tr')
  const options = useMemo(() => {
    const named = COUNTRY_CALLING_CODES.map(country => {
      const name = isTr ? country.nameTr : country.nameEn
      return {
        value: country.iso,
        label: `${name} +${country.dial}`,
        triggerLabel: '',
        leading: <CountryFlag iso={country.iso} />,
      }
    })
    const turkey = named.filter(item => item.value === 'TR')
    const germany = named.filter(item => item.value === 'DE')
    const rest = named
      .filter(item => item.value !== 'TR' && item.value !== 'DE')
      .sort((left, right) => left.label.localeCompare(right.label, isTr ? 'tr' : 'en'))
    return [...turkey, ...germany, ...rest]
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
      triggerClassName="h-[2.375rem] min-w-[4.25rem] px-2 text-[0.8125rem]"
      menuWidth={320}
      menuExpand="right"
    />
  )
}
