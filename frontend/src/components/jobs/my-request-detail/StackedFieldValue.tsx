import { EmptyCell } from '../../ui/EmptyCell'

// Birim/kişi ikili alanları "Birim / Kişi" tek satır yerine birim üstte kişi altta iki satır
// olarak gösterilir (Birime Gelen/Birimden Giden/Görev Bilgileri, cards #1295/#1544/#1545).
// Değerlerden biri eksikse eski `.filter(Boolean).join(' / ') || '—'` davranışı gibi tek satıra
// düşer — ikisi de eksikken çift "—" göstermez (codex review).
// Masaüstünde sağa yaslı; mobilde sol (card #1743 — değerler etiket yanına değil altına).
export function StackedFieldValue({ top, bottom }: { top: string | null | undefined; bottom: string | null | undefined }) {
  if (!top && !bottom) return <EmptyCell />
  if (!top) return <EmptyCell value={bottom} />
  if (!bottom) return <EmptyCell value={top} />
  return (
    <div className="stacked-field-value">
      <span>{top}</span>
      <span className="stacked-field-value__secondary">{bottom}</span>
    </div>
  )
}

/** Etiket: "A / B" yerine A üstte B altta, slash yok (#2650). */
export function StackedFieldLabel({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="stacked-field-label">
      <span>{top}</span>
      <span>{bottom}</span>
    </span>
  )
}
