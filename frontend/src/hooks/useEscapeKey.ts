import { useEffect } from 'react'

type EscapePriority = 'normal' | 'high'

/** ESC → handler; high öncelikli overlay açıkken normal handler çalışmaz (#2816). */
export function useEscapeKey(handler: () => void, enabled = true, priority: EscapePriority = 'normal') {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      const target = event.target as HTMLElement | null
      if (target?.closest('[data-escape-dismiss="false"]')) return

      if (priority === 'normal' && document.querySelector('[data-escape-overlay="high"]')) return

      event.preventDefault()
      if (priority === 'high') event.stopImmediatePropagation()
      handler()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, handler, priority])
}
