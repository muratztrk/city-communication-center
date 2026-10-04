import { ATTACHMENT_FILE_ACCEPT_EXTENSIONS } from './attachmentAccept'

/**
 * Dosya ekle için engellemeyen seçici (#3985 r3).
 * Windows Chrome'un klasik `<input type="file">` diyaloğu, belediye ağı dışındayken erişilemeyen
 * ağ konumlarını / son klasörü çözerken sayfayı 5-10 sn kilitleyebiliyor (JS tarafında çözülemez).
 * `showOpenFilePicker` asenkron çalışır ve `startIn: 'documents'` ile ağ klasörü yerine yerel
 * Belgeler'de açılır. Desteklenmiyorsa (Safari/Firefox, http) çağıranlar eski input'a düşer.
 */
interface OpenFilePickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  startIn?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}

type ShowOpenFilePicker = (options?: OpenFilePickerOptions) => Promise<Array<{ getFile: () => Promise<File> }>>

function getShowOpenFilePicker(): ShowOpenFilePicker | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null
  const picker = (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker }).showOpenFilePicker
  return typeof picker === 'function' ? picker.bind(window) : null
}

export function supportsAttachmentFilePicker(): boolean {
  return getShowOpenFilePicker() !== null
}

const ACCEPT_BY_MIME: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'video/mp4': ['.mp4'],
}

/** Seçilen dosyalar; kullanıcı vazgeçtiyse (veya seçici açılamadıysa) boş dizi. */
export async function pickAttachmentFiles(): Promise<File[]> {
  const showOpenFilePicker = getShowOpenFilePicker()
  if (!showOpenFilePicker) return []
  const allowed = new Set<string>(ATTACHMENT_FILE_ACCEPT_EXTENSIONS)
  const accept: Record<string, string[]> = {}
  for (const [mime, extensions] of Object.entries(ACCEPT_BY_MIME)) {
    const filtered = extensions.filter(extension => allowed.has(extension))
    if (filtered.length > 0) accept[mime] = filtered
  }
  try {
    const handles = await showOpenFilePicker({
      multiple: true,
      excludeAcceptAllOption: true,
      startIn: 'documents',
      types: [{ description: 'Resim, PDF ve Office', accept }],
    })
    return await Promise.all(handles.map(handle => handle.getFile()))
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      console.warn('Dosya seçici açılamadı', err)
    }
    return []
  }
}
