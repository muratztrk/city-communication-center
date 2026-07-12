// Birim/kişi ikili alanları "Birim / Kişi" tek satır yerine birim üstte kişi altta iki satır
// olarak gösterilir (Birime Gelen/Birimden Giden/Görev Bilgileri, cards #1295/#1544/#1545).
export function StackedFieldValue({ top, bottom }: { top: string | null | undefined; bottom: string | null | undefined }) {
  return (
    <div className="flex flex-col items-end text-right">
      <span>{top || '—'}</span>
      <span className="text-slate-500">{bottom || '—'}</span>
    </div>
  )
}
