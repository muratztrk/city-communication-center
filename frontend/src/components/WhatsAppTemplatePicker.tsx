import { useMemo, useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import type { WhatsAppMessageTemplate } from '../types/platform'
import { Button } from './ui/button'

interface WhatsAppTemplatePickerProps {
  templates: WhatsAppMessageTemplate[]
  onSelect: (content: string) => void
}

export function WhatsAppTemplatePicker({ templates, onSelect }: WhatsAppTemplatePickerProps) {
  const [open, setOpen] = useState(false)
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

  if (active.length === 0) return null

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(value => !value)}
        className="h-9 gap-1"
      >
        <FileText className="size-3.5" />
        Şablon Mesajlar
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="absolute bottom-full mb-1 right-0 z-50 w-64 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
          {active.map(tpl => (
            <button
              key={tpl.templateId}
              type="button"
              onClick={() => { onSelect(tpl.content); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-[color:var(--color-surface-raised)] transition-colors"
            >
              <p className="text-xs font-semibold text-[color:var(--color-foreground)] truncate">{tpl.name}</p>
              <p className="text-[11px] text-[color:var(--color-muted-foreground)] truncate mt-0.5">{tpl.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
