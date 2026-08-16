import type { TFunction } from 'i18next'
import type { SingleSelectOption } from '../components/ui/single-select-dropdown'

export function prioritySelectOptions(t: TFunction): SingleSelectOption[] {
  return [
    { value: 'Normal', label: t('enum.priority.Normal', 'Normal') },
    { value: 'High', label: t('enum.priority.High', 'Yüksek') },
    { value: 'VeryHigh', label: t('enum.priority.VeryHigh', 'Çok Yüksek') },
  ]
}

export function yesNoSelectOptions(t: TFunction): SingleSelectOption[] {
  return [
    { value: 'no', label: t('common.no', 'Hayır') },
    { value: 'yes', label: t('common.yes', 'Evet') },
  ]
}

export function stringListSelectOptions(items: string[]): SingleSelectOption[] {
  return items.map(item => ({ value: item, label: item }))
}
