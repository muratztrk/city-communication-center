import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const location = useLocation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLElement>(null)
  const preferredOpenGroupRef = useRef<string | null>(null)
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
  const activeGroupLabel = useMemo(() => {
    const activeGroup = items.find(item => item.type === 'group' && item.children.some(child => isPathActive(child.path)))
    return activeGroup?.label ?? null
  }, [isPathActive, items])

  const renderLink = (item: SidebarNavLinkItem, nested = false, measuring = false) => {
    const isActive = isPathActive(item.path)
    const Icon = item.icon
    const className = cn(
      'flex w-full min-w-0 items-center rounded-xl border text-left font-semibold transition-colors duration-150',
      collapsed ? 'justify-center gap-0 px-0 py-2.5 text-sm' : nested ? 'gap-2.5 px-3 py-1.5 text-xs' : 'gap-3 px-3 py-2 text-sm',
      isActive
        ? 'border-white/10 bg-white text-slate-950 shadow-sm'
        : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
    )
    const content = (
      <>
        <Icon className={cn('shrink-0', nested && !collapsed ? 'size-4' : 'size-4.5')} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </>
    )

    if (measuring) {
      return <div key={item.path} className={className}>{content}</div>
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={className}
        onClick={() => onNavigate?.()}
      >
        {content}
      </NavLink>
    )
  }

  const updateOverflowState = useCallback((preferredOpenLabel?: string | null) => {
    if (collapsed || groupLabels.length === 0) {
      return
    }

    const parent = wrapperRef.current?.parentElement
    if (!parent) return

    const allGroupsOpenHeight = measureRef.current?.scrollHeight ?? navRef.current?.scrollHeight ?? 0
    const wouldOverflow = allGroupsOpenHeight > parent.clientHeight + 2
    if (!wouldOverflow) {
      setAutoClosedGroups(current => current.size === 0 ? current : new Set())
      return
    }

    const keepLabel = preferredOpenLabel ?? activeGroupLabel ?? null
    const nextAutoClosedGroups = new Set(groupLabels.filter(label => label !== keepLabel))
    setAutoClosedGroups(current => areSetsEqual(current, nextAutoClosedGroups) ? current : nextAutoClosedGroups)
  }, [activeGroupLabel, collapsed, groupLabels])

  useLayoutEffect(() => {
    if (collapsed || groupLabels.length === 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      updateOverflowState(preferredOpenGroupRef.current)
      preferredOpenGroupRef.current = null
    })
    const observer = new ResizeObserver(() => updateOverflowState())
    const parent = wrapperRef.current?.parentElement
    if (parent) {
      observer.observe(parent)
    }
    if (measureRef.current) {
      observer.observe(measureRef.current)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [closedGroups, collapsed, groupLabels.length, updateOverflowState])

  const toggleGroup = (label: string, isOpen: boolean) => {
    preferredOpenGroupRef.current = isOpen ? null : label
    setClosedGroups(current => {
      const next = new Set(current)
      if (isOpen) {
        next.add(label)
      } else {
        next.delete(label)
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
    <div ref={wrapperRef} className="relative">
      <nav ref={navRef} className="grid gap-1.5">
        {items.map(item => {
          if (item.type !== 'group') {
            return renderLink(item)
          }

          const Icon = item.icon
          const isGroupActive = item.children.some(child => isPathActive(child.path))
          const isOpen = collapsed || (!closedGroups.has(item.label) && !effectiveAutoClosedGroups.has(item.label))
          return (
            <div key={item.label} className={cn('grid gap-1', collapsed ? 'justify-stretch' : '')}>
              {!collapsed ? (
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors duration-150',
                    isGroupActive
                      ? 'border-white/10 bg-white/10 text-white shadow-sm'
                      : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
                  )}
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(item.label, isOpen)}
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {isOpen ? <ChevronDown className="ml-auto size-4 shrink-0 opacity-70" /> : <ChevronRight className="ml-auto size-4 shrink-0 opacity-70" />}
                </button>
              ) : null}
              {isOpen ? (
                <div className={cn('grid gap-1', collapsed ? '' : 'ml-4 border-l border-white/10 pl-2.5')}>
                  {item.children.map(child => renderLink(child, true))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
      {!collapsed ? (
        <nav ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 grid gap-1.5">
          {items.map(item => {
            if (item.type !== 'group') {
              return renderLink(item, false, true)
            }

            const Icon = item.icon
            const isGroupActive = item.children.some(child => isPathActive(child.path))
            return (
              <div key={`measure-${item.label}`} className="grid gap-1">
                <div
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors duration-150',
                    isGroupActive
                      ? 'border-white/10 bg-white/10 text-white shadow-sm'
                      : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78',
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <ChevronDown className="ml-auto size-4 shrink-0 opacity-70" />
                </div>
                <div className="ml-4 grid gap-1 border-l border-white/10 pl-2.5">
                  {item.children.map(child => renderLink(child, true, true))}
                </div>
              </div>
            )
          })}
        </nav>
      ) : null}
    </div>
  )
}
