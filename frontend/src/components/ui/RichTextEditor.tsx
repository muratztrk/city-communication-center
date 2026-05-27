import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  minHeight?: string
}

type RichTextCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN'])
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS'])
const RICH_TEXT_TAG_PATTERN = /<\/?(p|div|br|ul|ol|li|strong|b|em|i|u|span)\b/i

const SAFE_FONT_SIZE_RE = /^\d+(\.\d+)?(px|pt|em|rem)$/
const SAFE_FONT_FAMILY_RE = /^[\w\s,'".-]+$/

const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Courier New', value: 'Courier New' },
]

const DEFAULT_FONT_FAMILY = 'Times New Roman'
const DEFAULT_FONT_SIZE = 12
const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16]

const TOOLBAR_COMMANDS: Array<{ command: RichTextCommand; label: string; icon: typeof Bold }> = [
  { command: 'bold', label: 'Kalın', icon: Bold },
  { command: 'italic', label: 'İtalik', icon: Italic },
  { command: 'underline', label: 'Altı Çizgili', icon: Underline },
  { command: 'insertUnorderedList', label: 'Madde İşareti', icon: List },
  { command: 'insertOrderedList', label: 'Numaralı Liste', icon: ListOrdered },
]

/** Tarayıcı font adlarını tırnak içinde döndürebilir ("Times New Roman") → temizle */
function stripFontQuotes(fontFamily: string): string {
  return fontFamily.replace(/['"]/g, '').trim()
}

function sanitizeSpanStyle(style: string): string {
  const parts: string[] = []
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (prop === 'font-size' && SAFE_FONT_SIZE_RE.test(val)) parts.push(`font-size: ${val}`)
    if (prop === 'font-family' && SAFE_FONT_FAMILY_RE.test(val)) parts.push(`font-family: ${val}`)
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

    if (!ALLOWED_TAGS.has(element.tagName)) {
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
  return documentRef.body.innerHTML
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

function getSelectionState(editor: HTMLElement): {
  commands: Partial<Record<RichTextCommand, boolean>>
  fontFamily: string
  fontSize: number
} {
  const selection = window.getSelection()
  if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) {
    return {
      commands: {},
      fontFamily: stripFontQuotes(editor.style.fontFamily) || DEFAULT_FONT_FAMILY,
      fontSize: parseFloat(editor.style.fontSize) || DEFAULT_FONT_SIZE,
    }
  }

  const commands: Partial<Record<RichTextCommand, boolean>> = {}
  let fontFamily = ''
  let fontSize = 0

  let element = getElementFromNode(selection.anchorNode)
  while (element && element !== editor) {
    if (element.tagName === 'B' || element.tagName === 'STRONG') commands.bold = true
    if (element.tagName === 'I' || element.tagName === 'EM') commands.italic = true
    if (element.tagName === 'U') commands.underline = true
    if (element.tagName === 'UL') commands.insertUnorderedList = true
    if (element.tagName === 'OL') commands.insertOrderedList = true

    if (element.tagName === 'SPAN') {
      const style = element.getAttribute('style') ?? ''
      if (!fontFamily) {
        const ff = /font-family:\s*([^;]+)/.exec(style)?.[1].trim().replace(/^["']|["']$/g, '').trim()
        if (ff) fontFamily = ff
      }
      if (!fontSize) {
        const fs = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(style)
        if (fs) fontSize = parseFloat(fs[1])
      }
    }

    element = element.parentElement
  }

  if (!fontFamily) fontFamily = stripFontQuotes(editor.style.fontFamily) || DEFAULT_FONT_FAMILY
  if (!fontSize) fontSize = parseFloat(editor.style.fontSize) || DEFAULT_FONT_SIZE

  return { commands, fontFamily, fontSize }
}

function applySpanStyle(editor: HTMLElement, styleProp: 'fontFamily' | 'fontSize', value: string) {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount || selection.isCollapsed) return

  editor.focus()
  const range = selection.getRangeAt(0)
  const span = document.createElement('span')
  span.style[styleProp] = value

  try {
    range.surroundContents(span)
  } catch {
    const fragment = range.extractContents()
    span.appendChild(fragment)
    range.insertNode(span)
  }

  selection.removeAllRanges()
  const newRange = document.createRange()
  newRange.selectNodeContents(span)
  selection.addRange(newRange)
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  required,
  className,
  minHeight = 'min-h-72',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastCommittedHtmlRef = useRef<string | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const normalizedValue = useMemo(() => normalizeEditorValue(value || ''), [value])
  const [activeCommands, setActiveCommands] = useState<Partial<Record<RichTextCommand, boolean>>>({})
  const [activeFontFamily, setActiveFontFamily] = useState(DEFAULT_FONT_FAMILY)
  const [activeFontSize, setActiveFontSize] = useState(DEFAULT_FONT_SIZE)
  const [editorFontFamily, setEditorFontFamily] = useState(DEFAULT_FONT_FAMILY)
  const [editorFontSize, setEditorFontSize] = useState(DEFAULT_FONT_SIZE)

  const emitChange = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const sanitizedHtml = isEditorEmpty(editor) ? '' : sanitizeRichTextHtml(editor.innerHTML)
    const nextHtml = normalizeEditorValue(sanitizedHtml)
    lastCommittedHtmlRef.current = nextHtml
    onChange(nextHtml)
  }, [onChange])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || lastCommittedHtmlRef.current === normalizedValue) return
    editor.innerHTML = normalizedValue
    lastCommittedHtmlRef.current = normalizedValue
  }, [normalizedValue])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const handleSel = () => {
      const selection = window.getSelection()
      if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return
      const { commands, fontFamily, fontSize } = getSelectionState(editor)
      setActiveCommands(commands)
      setActiveFontFamily(fontFamily)
      setActiveFontSize(fontSize)
    }
    document.addEventListener('selectionchange', handleSel)
    return () => document.removeEventListener('selectionchange', handleSel)
  }, [])

  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const saved = savedRangeRef.current
    if (!saved) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(saved)
  }

  const runCommand = (command: RichTextCommand) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const { commands: selState } = getSelectionState(editor)
    document.execCommand(command, false)
    setActiveCommands(current => ({
      ...current,
      [command]: !(current[command] || selState[command]),
      ...(command === 'insertUnorderedList' ? { insertOrderedList: false } : {}),
      ...(command === 'insertOrderedList' ? { insertUnorderedList: false } : {}),
    }))
    emitChange()
  }

  const handleFontFamily = (fontFamily: string) => {
    const editor = editorRef.current
    if (!editor || !fontFamily) return
    restoreSelection()
    const sel = window.getSelection()
    const hasTextSelected = sel && sel.rangeCount > 0 && !sel.isCollapsed && editor.contains(sel.anchorNode)
    if (hasTextSelected) {
      applySpanStyle(editor, 'fontFamily', fontFamily)
    } else {
      setEditorFontFamily(fontFamily)
    }
    setActiveFontFamily(fontFamily)
    emitChange()
  }

  const handleFontSize = (sizePx: number) => {
    const editor = editorRef.current
    if (!editor || !sizePx) return
    restoreSelection()
    const sel = window.getSelection()
    const hasTextSelected = sel && sel.rangeCount > 0 && !sel.isCollapsed && editor.contains(sel.anchorNode)
    if (hasTextSelected) {
      applySpanStyle(editor, 'fontSize', `${sizePx}px`)
    } else {
      setEditorFontSize(sizePx)
    }
    setActiveFontSize(sizePx)
    emitChange()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    window.setTimeout(emitChange, 0)
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Rich text controls">
        <select
          className="rich-text-toolbar-select rich-text-toolbar-select--font"
          value={activeFontFamily}
          title="Yazı tipi"
          onMouseDown={saveSelection}
          onChange={e => handleFontFamily(e.target.value)}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="rich-text-toolbar-select rich-text-toolbar-select--size"
          value={activeFontSize}
          title="Yazı boyutu"
          onMouseDown={saveSelection}
          onChange={e => handleFontSize(Number(e.target.value))}
        >
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="rich-text-toolbar-divider" aria-hidden="true" />

        {TOOLBAR_COMMANDS.map(({ command, label, icon: Icon }, index) => (
          <Fragment key={command}>
            <button
              type="button"
              className={`rich-text-toolbar-button ${activeCommands[command] ? 'active' : ''}`}
              aria-label={label}
              aria-pressed={Boolean(activeCommands[command])}
              title={label}
              onMouseDown={event => event.preventDefault()}
              onClick={() => runCommand(command)}
            >
              <Icon className="size-4" />
            </button>
            {index === 2 ? <span className="rich-text-toolbar-divider" aria-hidden="true" /> : null}
          </Fragment>
        ))}
      </div>

      <div
        ref={editorRef}
        className={['rich-text-editable', minHeight, className].filter(Boolean).join(' ')}
        style={{ fontFamily: editorFontFamily, fontSize: `${editorFontSize}px` }}
        contentEditable
        dir="ltr"
        role="textbox"
        aria-multiline="true"
        aria-required={required}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
      />
    </div>
  )
}
