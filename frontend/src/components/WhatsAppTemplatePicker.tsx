import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, FileText } from 'lucide-react'
import type { UserQuickReplyTemplate } from '../types/platform'
import { Button } from './ui/button'

interface WhatsAppTemplatePickerProps {
  userQuickReplies?: UserQuickReplyTemplate[]
  onSelect: (content: string) => void
  tone?: 'default' | 'on-dark'
  /** start = menu opens upward, aligned to button left (extends right); end = aligned to button right */
  menuAlign?: 'start' | 'end'
}

function computeMenuStyle(button: HTMLDivElement, itemCount: number, menuAlign: 'start' | 'end') {
  const rect = button.getBoundingClientRect()
  const menuWidth = 256
  const menuHeight = Math.min(256, itemCount * 56)
  const openUp = rect.top >= menuHeight + 8
  const left = menuAlign === 'start'
    ? Math.min(rect.left, window.innerWidth - menuWidth - 8)
    : Math.max(8, rect.right - menuWidth)
  return {
    top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
    left,
    width: menuWidth,
  }
}

export function WhatsAppTemplatePicker({
  userQuickReplies = [],
  onSelect,
  tone = 'default',
  menuAlign = 'end',
}: WhatsAppTemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const active = useMemo(() => {
    return userQuickReplies
      .map(t => ({ id: t.templateId, name: t.name, content: t.content }))
      .sort((left, right) => left.name.localeCompare(right.name, 'tr'))
  }, [userQuickReplies])

  useLayoutEffect(() => {
    if (open && menuRef.current) {
      menuRef.current.scrollTop = 0
    }
  }, [open, menuStyle])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setMenuStyle(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const isEmpty = active.length === 0

  const toggleOpen = () => {
    if (isEmpty) return
    if (open) {
      setOpen(false)
      setMenuStyle(null)
      return
    }
    if (buttonRef.current) {
      setMenuStyle(computeMenuStyle(buttonRef.current, active.length, menuAlign))
    }
    setOpen(true)
  }

  const menu = open && menuStyle ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] max-h-64 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg divide-y divide-slate-100"
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
    >
      {active.map(tpl => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => { onSelect(tpl.content); setOpen(false); setMenuStyle(null) }}
          className="w-full text-left px-3 py-2 hover:bg-[color:var(--color-surface-raised)] transition-colors"
        >
          <p className="text-xs font-semibold text-[color:var(--color-foreground)] truncate">{tpl.name}</p>
          <p className="text-[11px] text-[color:var(--color-muted-foreground)] truncate mt-0.5">{tpl.content}</p>
        </button>
      ))}
    </div>,
    document.body,
  ) : null

  const isOnDark = tone === 'on-dark'

  return (
    <div className="relative shrink-0" ref={buttonRef}>
      <Button
        type="button"
        size="sm"
        variant={isOnDark ? 'ghost' : 'secondary'}
        onClick={toggleOpen}
        disabled={isEmpty}
        className={
          isOnDark
            ? 'h-9 gap-1.5 rounded-full border border-white/30 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent'
            : 'h-9 gap-1 disabled:opacity-50'
        }
      >
        <FileText className="size-3.5" />
        Şablon mesajlar
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {menu}
    </div>
  )
}

export function TemplateDropdownList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  items: UserQuickReplyTemplate[]
  selectedId?: string | null
  onSelect: (template: UserQuickReplyTemplate) => void
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {items.map(template => (
        <button
          key={template.templateId}
          type="button"
          onClick={() => onSelect(template)}
          className={`w-full text-left px-3 py-2 transition-colors hover:bg-slate-50 ${
            selectedId === template.templateId ? 'bg-emerald-50/70' : ''
          }`}
        >
          <p className="text-xs font-semibold text-slate-900 truncate">{template.name}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{template.content}</p>
        </button>
      ))}
    </div>
  )
}
