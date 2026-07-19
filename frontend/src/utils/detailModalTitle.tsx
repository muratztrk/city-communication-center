/**
 * Detay popup başlığını (Talep/Görev No + başlık) ilk kelime birinci satırda,
 * kalanı mobilde ikinci satırda gösterecek şekilde böler (card #1728).
 * Masaüstünde `.detail-modal-title-rest` inline kalır — tek satır görünümü değişmez.
 */
export function DetailModalTitle({ title }: { title: string }) {
  const trimmed = title.trim()
  const firstSpaceIndex = trimmed.indexOf(' ')

  if (firstSpaceIndex === -1) {
    return <>{trimmed}</>
  }

  const firstWord = trimmed.slice(0, firstSpaceIndex)
  const rest = trimmed.slice(firstSpaceIndex + 1)

  return (
    <>
      {firstWord}{' '}
      <span className="detail-modal-title-rest">{rest}</span>
    </>
  )
}
