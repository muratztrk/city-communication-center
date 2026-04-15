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
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="grid gap-1.5">
      {items.map(item => {
        const isActive = location.pathname.startsWith(item.path)
        const Icon = item.icon

        return (
          <button
            key={item.path}
            type="button"
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex w-full min-w-0 items-center rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150',
              collapsed ? 'justify-center gap-0 px-0' : 'gap-3',
              isActive
                ? 'border-white/10 bg-white text-slate-950 shadow-sm'
                : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
            )}
            onClick={() => {
              navigate(item.path)
              onNavigate?.()
            }}
          >
            <Icon className="size-4.5 shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
