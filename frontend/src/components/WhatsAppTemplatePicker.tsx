import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, FileText } from 'lucide-react'
import type { WhatsAppMessageTemplate } from '../types/platform'
import { Button } from './ui/button'

interface WhatsAppTemplatePickerProps {
  templates: WhatsAppMessageTemplate[]
  onSelect: (content: string) => void
  tone?: 'default' | 'on-dark'
}

function computeMenuStyle(button: HTMLDivElement, itemCount: number) {
  const rect = button.getBoundingClientRect()
  const menuWidth = 256
  const menuHeight = Math.min(256, itemCount * 56)
  const openUp = rect.top >= menuHeight + 8
  return {
    top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
    left: Math.max(8, rect.right - menuWidth),
    width: menuWidth,
  }
}

export function WhatsAppTemplatePicker({ templates, onSelect, tone = 'default' }: WhatsAppTemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const active = useMemo(() => {
    const filtered = templates.filter(t => t.isActive && (t.channel === 'Genel' || t.channel === 'WhatsApp'))
    const pinnedOrder = ['KVKK Hoşgeldiniz', 'Eksik Bilgi']
    return [...filtered].sort((left, right) => {
      const leftIndex = pinnedOrder.indexOf(left.name)
      const rightIndex = pinnedOrder.indexOf(right.name)
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1
        if (rightIndex === -1) return -1
        return leftIndex - rightIndex
      }
      return left.name.localeCompare(right.name, 'tr')
    })
  }, [templates])

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

  if (active.length === 0) return null

  const toggleOpen = () => {
    if (open) {
      setOpen(false)
      setMenuStyle(null)
      return
    }
    if (buttonRef.current) {
      setMenuStyle(computeMenuStyle(buttonRef.current, active.length))
    }
    setOpen(true)
  }

  const menu = open && menuStyle ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] max-h-64 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg"
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
    >
      {active.map(tpl => (
        <button
          key={tpl.templateId}
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
        className={
          isOnDark
            ? 'h-9 gap-1.5 rounded-full border border-white/30 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white'
            : 'h-9 gap-1'
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
