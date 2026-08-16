import { List, ListOrdered, type LucideIcon } from 'lucide-react'
import { Fragment, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  minHeight?: string
  /** Düz metin (görünen karakter) sınırı; tüm açıklama alanlarında varsayılan 400 (card #1351). */
  maxLength?: number
  /** Blur'da HTML'i normalize et (ör. ilk harf büyük — #6a6f496e). */
  normalizeOnBlur?: (value: string) => string
}

type RichTextCommand = 'bold' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'U', 'SPAN'])
const UNWRAPPED_TAGS = new Set(['EM', 'I']) // İtalik yok — etiket içeriği korunur (#r511)
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS'])
const RICH_TEXT_TAG_PATTERN = /<\/?(p|div|br|ul|ol|li|strong|b|u|span)\b/i

const SAFE_FONT_SIZE_RE = /^\d+(\.\d+)?(px|pt|em|rem)$/
const SAFE_FONT_FAMILY_RE = /^[\w\s,'".-]+$/

const TOOLBAR_COMMANDS: Array<{ command: RichTextCommand; label: string; icon?: LucideIcon; text?: string }> = [
  { command: 'bold', label: 'Kalın', text: 'K' },
  { command: 'underline', label: 'Altı Çizgili', text: 'A' },
  { command: 'insertUnorderedList', label: 'Madde İşareti', icon: List },
  { command: 'insertOrderedList', label: 'Numaralı Liste', icon: ListOrdered },
]

function sanitizeSpanStyle(style: string): string {
  const parts: string[] = []
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (prop === 'font-size' && SAFE_FONT_SIZE_RE.test(val)) parts.push(`font-size: ${val}`)
    if (prop === 'font-family' && SAFE_FONT_FAMILY_RE.test(val)) parts.push(`font-family: ${val}`)
    // font-style (italic) kasıtlı olarak atlanır (#r511)
  }
  return parts.join('; ')
}

function looksLikeRichTextHtml(value: string): boolean {
  return RICH_TEXT_TAG_PATTERN.test(value)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(value: string): string {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''
  return normalized
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function sanitizeNode(parent: Node, documentRef: Document) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child)
      continue
    }

    const element = child as HTMLElement

    if (DROPPED_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }

    sanitizeNode(element, documentRef)

    if (UNWRAPPED_TAGS.has(element.tagName) || !ALLOWED_TAGS.has(element.tagName)) {
      const fragment = documentRef.createDocumentFragment()
      while (element.firstChild) fragment.appendChild(element.firstChild)
      element.replaceWith(fragment)
      continue
    }

    if (element.tagName === 'SPAN') {
      const safeStyle = sanitizeSpanStyle(element.getAttribute('style') ?? '')
      for (const attr of Array.from(element.attributes)) element.removeAttribute(attr.name)
      if (safeStyle) {
        element.setAttribute('style', safeStyle)
      } else {
        const fragment = documentRef.createDocumentFragment()
        while (element.firstChild) fragment.appendChild(element.firstChild)
        element.replaceWith(fragment)
      }
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name)
    }
  }
}

function sanitizeRichTextHtml(value: string): string {
  if (!value.trim() || typeof DOMParser === 'undefined') return ''
  const documentRef = new DOMParser().parseFromString(value, 'text/html')
  sanitizeNode(documentRef.body, documentRef)
  removeEmptyBlockParagraphs(documentRef.body)
  return documentRef.body.innerHTML
}

/** Kayıtta boş <p><br></p> blokları satır aralığını bozuyor (Windows Edge insertParagraph). */
function removeEmptyBlockParagraphs(root: HTMLElement) {
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLElement && (child.tagName === 'P' || child.tagName === 'DIV')) {
      const text = child.innerText.replace(/\u00a0/g, ' ').trim()
      if (!text) {
        child.remove()
      }
    }
  }
}

function normalizeEditorValue(value: string): string {
  if (!value.trim()) return ''
  return looksLikeRichTextHtml(value) ? sanitizeRichTextHtml(value) : plainTextToHtml(value)
}

function isEditorEmpty(editor: HTMLElement): boolean {
  return !editor.innerText.replace(/\u00a0/g, ' ').trim()
}

function getElementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null
  return node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement
}

function getSelectionCommands(editor: HTMLElement): Partial<Record<RichTextCommand, boolean>> {
  const selection = window.getSelection()
  if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return {}

  const commands: Partial<Record<RichTextCommand, boolean>> = {}
  let element = getElementFromNode(selection.anchorNode)
  while (element && element !== editor) {
    if (element.tagName === 'B' || element.tagName === 'STRONG') commands.bold = true
    if (element.tagName === 'U') commands.underline = true
    if (element.tagName === 'UL') commands.insertUnorderedList = true
    if (element.tagName === 'OL') commands.insertOrderedList = true
    element = element.parentElement
  }
  return commands
}

const MIN_TO_MAX_HEIGHT: Record<string, string> = {
  'min-h-72': 'max-h-72',
  'min-h-64': 'max-h-64',
  'min-h-48': 'max-h-48',
  'min-h-40': 'max-h-40',
  'min-h-28': 'max-h-28',
}

function toMaxHeightClass(minHeightClass: string): string {
  // Tailwind JIT için sınıflar kaynakta literal görünmeli; runtime replace yetmez (card #1533).
  return MIN_TO_MAX_HEIGHT[minHeightClass] ?? minHeightClass.replace(/\bmin-h-/g, 'max-h-')
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  required,
  className,
  minHeight = 'min-h-72',
  maxLength = 400,
  normalizeOnBlur,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastCommittedHtmlRef = useRef<string | null>(null)
  const normalizedValue = useMemo(() => normalizeEditorValue(value || ''), [value])
  const [activeCommands, setActiveCommands] = useState<Partial<Record<RichTextCommand, boolean>>>({})
  const maxHeight = useMemo(() => toMaxHeightClass(minHeight), [minHeight])

  const emitRafRef = useRef<number | null>(null)

  const emitChange = useCallback(() => {
    if (emitRafRef.current != null) {
      window.cancelAnimationFrame(emitRafRef.current)
    }
    emitRafRef.current = window.requestAnimationFrame(() => {
      emitRafRef.current = null
      const editor = editorRef.current
      if (!editor) return
      const sanitizedHtml = isEditorEmpty(editor) ? '' : sanitizeRichTextHtml(editor.innerHTML)
      const nextHtml = normalizeEditorValue(sanitizedHtml)
      lastCommittedHtmlRef.current = nextHtml
      startTransition(() => onChange(nextHtml))
    })
  }, [onChange])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || lastCommittedHtmlRef.current === normalizedValue) return
    // Seri backspace sırasında parent value → innerHTML senkronu imleci satır başına atıyordu (#2412).
    if (editor.contains(document.activeElement)) return
    editor.innerHTML = normalizedValue
    lastCommittedHtmlRef.current = normalizedValue
  }, [normalizedValue])

  // Windows Edge/Türkçe IME: spellCheck={false} yetmez; attribute'ları açıkça kapat (#spellcheck-win).
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.setAttribute('spellcheck', 'false')
    editor.setAttribute('autocorrect', 'off')
    editor.setAttribute('autocomplete', 'off')
    editor.setAttribute('data-gramm', 'false')
    editor.setAttribute('data-gramm_editor', 'false')
    editor.setAttribute('data-enable-grammarly', 'false')
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const handleSel = () => {
      const selection = window.getSelection()
      if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return
      setActiveCommands(getSelectionCommands(editor))
    }
    document.addEventListener('selectionchange', handleSel)
    return () => document.removeEventListener('selectionchange', handleSel)
  }, [])

  const runCommand = (command: RichTextCommand) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selState = getSelectionCommands(editor)
    document.execCommand(command, false)
    setActiveCommands(current => ({
      ...current,
      [command]: !(current[command] || selState[command]),
      ...(command === 'insertUnorderedList' ? { insertOrderedList: false } : {}),
      ...(command === 'insertOrderedList' ? { insertUnorderedList: false } : {}),
    }))
    emitChange()
  }

  const getEditorTextLength = () => {
    const editor = editorRef.current
    if (!editor) return 0
    return editor.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '').length
  }

  const getSelectedTextLength = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return 0
    return selection.toString().length
  }

  const handleBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent
    if (!inputEvent.inputType?.startsWith('insert')) return
    const insertedLength = inputEvent.data?.length ?? 1
    if (getEditorTextLength() - getSelectedTextLength() + insertedLength > maxLength) {
      event.preventDefault()
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const remaining = Math.max(0, maxLength - (getEditorTextLength() - getSelectedTextLength()))
    const text = event.clipboardData.getData('text/plain').slice(0, remaining)
    if (text) document.execCommand('insertText', false, text)
    window.setTimeout(emitChange, 0)
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Rich text controls">
        {TOOLBAR_COMMANDS.map(({ command, label, icon: Icon, text }, index) => (
          <Fragment key={command}>
            {index === 2 ? <span className="rich-text-toolbar-divider" aria-hidden="true" /> : null}
            <button
              type="button"
              className={`rich-text-toolbar-button ${activeCommands[command] ? 'active' : ''}`}
              aria-label={label}
              aria-pressed={Boolean(activeCommands[command])}
              title={label}
              onMouseDown={event => event.preventDefault()}
              onClick={() => runCommand(command)}
            >
              {Icon ? (
                <Icon className="size-3.5" />
              ) : (
                <span
                  className={`inline-flex min-w-[1rem] items-center justify-center text-[13px] font-bold leading-none ${
                    command === 'underline' ? 'underline' : ''
                  }`}
                >
                  {text}
                </span>
              )}
            </button>
          </Fragment>
        ))}
      </div>

      <div
        ref={editorRef}
        className={['rich-text-editable', 'overflow-y-auto', minHeight, maxHeight, className].filter(Boolean).join(' ')}
        contentEditable
        dir="ltr"
        role="textbox"
        aria-multiline="true"
        aria-required={required}
        data-placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={() => {
          if (normalizeOnBlur && editorRef.current) {
            const current = isEditorEmpty(editorRef.current) ? '' : editorRef.current.innerHTML
            const next = normalizeOnBlur(current)
            if (next !== current) {
              editorRef.current.innerHTML = next
            }
          }
          if (emitRafRef.current != null) {
            window.cancelAnimationFrame(emitRafRef.current)
            emitRafRef.current = null
          }
          const editor = editorRef.current
          if (!editor) return
          const sanitizedHtml = isEditorEmpty(editor) ? '' : sanitizeRichTextHtml(editor.innerHTML)
          const nextHtml = normalizeEditorValue(sanitizedHtml)
          lastCommittedHtmlRef.current = nextHtml
          onChange(nextHtml)
        }}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onKeyDown={event => {
          // Ctrl/Cmd+I tarayıcı italik kısayolunu engelle (#r511)
          if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr') === 'i') {
            event.preventDefault()
          }
          // Enter → satır içi <br> (eşit line-height); liste içinde tarayıcı varsayılanı (#6a74e697 / Windows).
          if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const editor = editorRef.current
            if (!editor) return
            const inList = Boolean(
              getSelectionCommands(editor).insertUnorderedList || getSelectionCommands(editor).insertOrderedList,
            )
            if (inList) return
            event.preventDefault()
            document.execCommand('insertLineBreak')
            emitChange()
          }
        }}
      />
    </div>
  )
}
