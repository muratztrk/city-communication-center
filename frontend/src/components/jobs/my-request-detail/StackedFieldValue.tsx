// Birim/kişi ikili alanları "Birim / Kişi" tek satır yerine birim üstte kişi altta iki satır
// olarak gösterilir (Birime Gelen/Birimden Giden/Görev Bilgileri, cards #1295/#1544/#1545).
// Değerlerden biri eksikse eski `.filter(Boolean).join(' / ') || '—'` davranışı gibi tek satıra
// düşer — ikisi de eksikken çift "—" göstermez (codex review).
export function StackedFieldValue({ top, bottom }: { top: string | null | undefined; bottom: string | null | undefined }) {
  if (!top && !bottom) return <>—</>
  if (!top) return <>{bottom}</>
  if (!bottom) return <>{top}</>
  return (
    <div className="flex flex-col items-end text-right">
      <span>{top}</span>
      <span className="text-slate-500">{bottom}</span>
    </div>
  )
}
