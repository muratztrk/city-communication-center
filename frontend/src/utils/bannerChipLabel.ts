/** Banner altındaki kapsam çiplerinden "Talepler/Görevler" ekini düşürür. */
export function shortenBannerChipLabel(label: string): string {
  const trimmed = label.trim()
  if (trimmed === 'Tüm Taleplerim' || trimmed === 'Tüm Görevlerim') return 'Tümü'
  if (trimmed === 'Birim İçi/Dışı Tüm Görevler') return 'Birim İçi/Dışı'
  return trimmed
    .replace(/ Taleplerim$/, '')
    .replace(/ Görevlerim$/, '')
    .replace(/ Talepler$/, '')
    .replace(/ Görevler$/, '')
}
