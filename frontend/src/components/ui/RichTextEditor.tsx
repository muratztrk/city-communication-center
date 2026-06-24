import { List, ListOrdered, type LucideIcon } from 'lucide-react'
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

const TOOLBAR_COMMANDS: Array<{ command: RichTextCommand; label: string; icon?: LucideIcon; text?: string }> = [
  { command: 'bold', label: 'Kalın', text: 'K' },
  { command: 'italic', label: 'İtalik', text: 'T' },
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

function getSelectionCommands(editor: HTMLElement): Partial<Record<RichTextCommand, boolean>> {
  const selection = window.getSelection()
  if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return {}

  const commands: Partial<Record<RichTextCommand, boolean>> = {}
  let element = getElementFromNode(selection.anchorNode)
  while (element && element !== editor) {
    if (element.tagName === 'B' || element.tagName === 'STRONG') commands.bold = true
    if (element.tagName === 'I' || element.tagName === 'EM') commands.italic = true
    if (element.tagName === 'U') commands.underline = true
    if (element.tagName === 'UL') commands.insertUnorderedList = true
    if (element.tagName === 'OL') commands.insertOrderedList = true
    element = element.parentElement
  }
  return commands
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
  const normalizedValue = useMemo(() => normalizeEditorValue(value || ''), [value])
  const [activeCommands, setActiveCommands] = useState<Partial<Record<RichTextCommand, boolean>>>({})

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

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    window.setTimeout(emitChange, 0)
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Rich text controls">
        {TOOLBAR_COMMANDS.map(({ command, label, icon: Icon, text }, index) => (
          <Fragment key={command}>
            {index === 3 ? <span className="rich-text-toolbar-divider" aria-hidden="true" /> : null}
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
                <Icon className="size-4" />
              ) : (
                <span
                  className={`inline-flex min-w-[1rem] items-center justify-center text-sm font-bold leading-none ${
                    command === 'italic' ? 'italic' : command === 'underline' ? 'underline' : ''
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
        className={['rich-text-editable', minHeight, className].filter(Boolean).join(' ')}
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
