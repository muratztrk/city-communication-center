// Bazı eski kayıtlarda görev tamamlama notu RichTextEditor'dan kalma <p>...</p> HTML içerir.
// Düz metin gösterilecek yerlerde (Tamamlama Notu pop-up'ı, dışa aktarım) bu etiketler literal
// "<p>...</p>" olarak görünüyordu; bu helper etiketleri temizler, blok kapanışlarını satır
// sonuna çevirir, HTML varlıklarını ve &nbsp; / U+00A0 değerini çözer (card #1012).
export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return ''

  let text = value
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  if (typeof DOMParser !== 'undefined') {
    text = new DOMParser().parseFromString(text, 'text/html').body.textContent ?? text
  }

  return text
    .replace(/&(?:amp;)*nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
