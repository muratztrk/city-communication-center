import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface SidebarNavLinkItem {
  type?: 'link'
  path: string
  label: string
  icon: LucideIcon
}

export interface SidebarNavGroupItem {
  type: 'group'
  label: string
  icon: LucideIcon
  children: SidebarNavLinkItem[]
}

export type SidebarNavItem = SidebarNavLinkItem | SidebarNavGroupItem

interface SidebarNavProps {
  items: SidebarNavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set())
  const [autoClosedGroups, setAutoClosedGroups] = useState<Set<string>>(() => new Set())
  const currentPath = `${location.pathname}${location.search}`
  const groupLabels = useMemo(() => items.filter(item => item.type === 'group').map(item => item.label), [items])

  const isPathActive = useCallback((path: string) => {
    if (path.includes('?')) {
      return currentPath === path
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }, [currentPath, location.pathname])

  const renderLink = (item: SidebarNavLinkItem, nested = false) => {
    const isActive = isPathActive(item.path)
    const Icon = item.icon

    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex w-full min-w-0 items-center rounded-xl border text-left font-semibold transition-colors duration-150',
          collapsed ? 'justify-center gap-0 px-0 py-2.5 text-sm' : nested ? 'gap-2 px-3 py-2 text-xs' : 'gap-3 px-3 py-2.5 text-sm',
          isActive
            ? 'border-white/10 bg-white text-slate-950 shadow-sm'
            : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
        )}
        onClick={() => onNavigate?.()}
      >
        <Icon className={cn('shrink-0', nested && !collapsed ? 'size-4' : 'size-4.5')} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </NavLink>
    )
  }

  useEffect(() => {
    if (collapsed || groupLabels.length === 0) {
      return
    }

    const updateOverflowState = () => {
      const parent = navRef.current?.parentElement
      if (!parent) return

      const isOverflowing = parent.scrollHeight > parent.clientHeight + 2
      if (!isOverflowing) {
        setAutoClosedGroups(current => current.size === 0 ? current : new Set())
        return
      }

      setAutoClosedGroups(() => {
        const activeGroup = items.find(item => item.type === 'group' && item.children.some(child => isPathActive(child.path)))
        return new Set(groupLabels.filter(label => label !== activeGroup?.label))
      })
    }

    const frameId = window.requestAnimationFrame(updateOverflowState)
    const observer = new ResizeObserver(updateOverflowState)
    if (navRef.current?.parentElement) {
      observer.observe(navRef.current.parentElement)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [collapsed, groupLabels, isPathActive, items])

  const toggleGroup = (label: string) => {
    setClosedGroups(current => {
      const next = new Set(current)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
    setAutoClosedGroups(current => {
      if (!current.has(label)) return current
      const next = new Set(current)
      next.delete(label)
      return next
    })
  }
  const effectiveAutoClosedGroups = collapsed ? new Set<string>() : autoClosedGroups

  return (
    <nav ref={navRef} className="grid gap-2">
      {items.map(item => {
        if (item.type !== 'group') {
          return renderLink(item)
        }

        const Icon = item.icon
        const isGroupActive = item.children.some(child => isPathActive(child.path))
        const isOpen = collapsed || (!closedGroups.has(item.label) && (!effectiveAutoClosedGroups.has(item.label) || isGroupActive))
        return (
          <div key={item.label} className={cn('grid gap-1', collapsed ? 'justify-stretch' : 'pt-1')}>
            {!collapsed ? (
              <button
                type="button"
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-lg px-2 pt-1 pb-0.5 text-left text-[0.68rem] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-white/8 hover:text-white',
                  isGroupActive ? 'text-white' : 'text-[color:var(--color-sidebar-foreground)]/48',
                )}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(item.label)}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {isOpen ? <ChevronDown className="ml-auto size-3.5 shrink-0" /> : <ChevronRight className="ml-auto size-3.5 shrink-0" />}
              </button>
            ) : null}
            {isOpen ? (
              <div className={cn('grid gap-1', collapsed ? '' : 'pl-2')}>
                {item.children.map(child => renderLink(child, true))}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
