import type { ConfirmDialogState } from '../components/ui/confirm-dialog'

/** Türkçe büyük/küçük harf duyarsız ad karşılaştırması (başındaki/sonundaki boşluk yok sayılır). */
export function normalizeNameForCompare(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('tr')
}

export function hasDuplicateName(
  names: readonly (string | null | undefined)[],
  candidate: string,
): boolean {
  const target = normalizeNameForCompare(candidate)
  return target.length > 0 && names.some(name => normalizeNameForCompare(name) === target)
}

/** Aynı adla kayıt oluşturulmak istendiğinde çıkan bilgi popup'ı (başlık çizgili, yalnız Tamam). */
export function buildDuplicateNameDialog(title: string, message: string, confirmLabel: string): ConfirmDialogState {
  return {
    title,
    titleDivider: true,
    message,
    hideCancel: true,
    confirmLabel,
    variant: 'primary',
    onConfirm: () => undefined,
  }
}
