// Bazı eski kayıtlarda görev tamamlama notu RichTextEditor'dan kalma <p>...</p> HTML içerir.
// Düz metin gösterilecek yerlerde (Tamamlama Notu pop-up'ı, dışa aktarım) bu etiketler literal
// "<p>...</p>" olarak görünüyordu; bu helper etiketleri temizler, blok kapanışlarını satır
// sonuna çevirir, HTML varlıklarını ve &nbsp; / U+00A0 değerini çözer (card #1012).
const RICH_TEXT_TAG_RE = /<\/?(?:p|div|br|li|h[1-6]|ul|ol|span|strong|em|b|i)\b[^>]*>/i

function containsRichTextMarkup(value: string): boolean {
  return RICH_TEXT_TAG_RE.test(value)
}

function decodeHtmlEntities(text: string): string {
  if (typeof DOMParser !== 'undefined') {
    // Ham < karakterleri (ör. talep başlığı "<zx<zx") DOMParser'da etiket sanılıp metni keser.
    const safe = text.replace(/</g, '&lt;')
    return new DOMParser().parseFromString(safe, 'text/html').body.textContent ?? text
  }

  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return ''

  let text = value

  if (containsRichTextMarkup(text)) {
    text = text
      .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  }

  text = decodeHtmlEntities(text)

  return text
    .replace(/&(?:amp;)*nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
