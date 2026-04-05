import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SidebarNavItem {
  path: string
  label: string
  icon: LucideIcon
}

interface SidebarNavProps {
  items: SidebarNavItem[]
}

export function SidebarNav({ items }: SidebarNavProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
      {items.map(item => {
        const isActive = location.pathname.startsWith(item.path)
        const Icon = item.icon

        return (
          <button
            key={item.path}
            type="button"
            className={cn(
              'flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
              isActive
                ? 'bg-white text-slate-950 shadow-[0_14px_34px_rgba(16,47,74,0.18)]'
                : 'text-[color:var(--color-sidebar-foreground)]/80 hover:bg-white/10 hover:text-white',
            )}
            onClick={() => navigate(item.path)}
          >
            <Icon className="size-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
