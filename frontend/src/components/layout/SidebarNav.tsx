import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'

const PAGE_SIZE = 10

export interface SidebarNavLinkItem {
  type?: 'link'
  path: string
  label: string
  icon?: LucideIcon
  iconImageSrc?: string
  newTab?: boolean
  /** Render label on two lines (e.g. long menu titles). */
  multilineLabel?: boolean
  /** Slightly enlarge important nested links without changing the whole sidebar. */
  emphasized?: boolean
}

export interface SidebarNavGroupItem {
  type: 'group'
  label: string
  icon: LucideIcon
  path?: string
  children: SidebarNavLinkItem[]
}

export interface SidebarNavSeparatorItem {
  type: 'separator'
}

export type SidebarNavItem = SidebarNavLinkItem | SidebarNavGroupItem | SidebarNavSeparatorItem

interface SidebarNavProps {
  items: SidebarNavItem[]
  collapsed?: boolean
  defaultActivePaths?: string[]
  onNavigate?: () => void
}

export function SidebarNav({ items, collapsed = false, defaultActivePaths = [], onNavigate }: SidebarNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [groupPages, setGroupPages] = useState<Map<string, number>>(() => new Map())
  const currentPath = `${location.pathname}${location.search}`
  const defaultActivePathSet = useMemo(() => new Set(defaultActivePaths), [defaultActivePaths])

  const isPathActive = useCallback((path: string) => {
    if (path.includes('?')) {
      const [targetPath] = path.split('?')
      return location.pathname === targetPath
    }
    if (location.pathname === path) {
      return location.search === ''
    }
    return location.pathname.startsWith(`${path}/`)
  }, [location.pathname, location.search])

  const getGroupPage = useCallback((label: string) => groupPages.get(label) ?? 0, [groupPages])
  const setGroupPage = useCallback((label: string, page: number) => {
    setGroupPages(current => {
      const next = new Map(current)
      next.set(label, page)
      return next
    })
  }, [])

  useEffect(() => {
    items.forEach(item => {
      if (item.type !== 'group') return
      const activeIndex = item.children.findIndex(child => isPathActive(child.path))
      if (activeIndex < 0) return
      const correctPage = Math.floor(activeIndex / PAGE_SIZE)
      if (correctPage !== getGroupPage(item.label)) {
        setGroupPage(item.label, correctPage)
      }
    })
  }, [currentPath, items, getGroupPage, setGroupPage, isPathActive])

  const renderLink = (item: SidebarNavLinkItem, nested = false, forceActive = false) => {
    const isActive = isPathActive(item.path) || forceActive
    const Icon = item.icon
    const isEmphasizedNested = nested && item.emphasized && !collapsed
    const className = cn(
      'flex w-full min-w-0 items-center rounded-xl border text-left font-semibold transition-colors duration-150',
      collapsed
        ? 'justify-center gap-0 px-0 py-2.5 text-sm'
        : isEmphasizedNested
          ? 'gap-3 px-3.5 py-2 text-[0.85rem] font-bold'
          : nested
            ? 'gap-2.5 px-3 py-1.5 text-xs'
            : item.multilineLabel
              ? 'gap-3 px-3 py-2 text-sm leading-snug'
              : 'gap-3 px-3 py-2 text-sm',
      isActive
        ? 'border-white/10 bg-white text-slate-950 shadow-sm'
        : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
    )

    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={item.label}
        className={className}
        target={item.newTab ? '_blank' : undefined}
        rel={item.newTab ? 'noopener noreferrer' : undefined}
        onClick={() => onNavigate?.()}
      >
        {item.iconImageSrc ? (
          <img src={item.iconImageSrc} alt="" className={cn('shrink-0 object-contain', isEmphasizedNested ? 'size-5' : nested && !collapsed ? 'size-4' : 'size-4.5')} />
        ) : Icon ? (
          <Icon className={cn('shrink-0', isEmphasizedNested ? 'size-5' : nested && !collapsed ? 'size-4' : 'size-4.5')} />
        ) : null}
        {!collapsed ? (
          <span className={cn('min-w-0', item.multilineLabel ? 'whitespace-pre-line leading-snug' : 'truncate')}>{item.label}</span>
        ) : null}
      </NavLink>
    )
  }

  return (
    <div className="relative">
      <nav className="grid gap-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const separator = !isLast ? (
            <div className="mx-2 h-px bg-white/[0.09]" />
          ) : null

          if (item.type === 'separator') {
            return <div key={`sep-${index}`} className="mx-2 my-1 h-[2px] rounded-full bg-white/[0.18]" />
          }

          if (item.type !== 'group') {
            return (
              <Fragment key={item.path}>
                <div className="py-0.5">{renderLink(item)}</div>
                {separator}
              </Fragment>
            )
          }

          const Icon = item.icon
          const isGroupActive = item.children.some(child => isPathActive(child.path))
          const groupHasActiveChild = isGroupActive

          return (
            <Fragment key={item.label}>
            <div className={cn('grid gap-1 py-0.5', collapsed ? 'justify-stretch' : '')}>
              {!collapsed ? (
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors duration-150',
                    isGroupActive
                      ? 'border-white/10 bg-white/10 text-white shadow-sm'
                      : 'border-transparent text-[color:var(--color-sidebar-foreground)]/78 hover:border-white/8 hover:bg-white/8 hover:text-white',
                  )}
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path)
                      onNavigate?.()
                    }
                  }}
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="truncate" title={item.label}>{item.label}</span>
                </button>
              ) : null}
              <div className={cn('grid gap-1', collapsed ? '' : 'ml-4 border-l border-white/10 pl-2.5')}>
                {(() => {
                  const page = getGroupPage(item.label)
                  const totalPages = Math.ceil(item.children.length / PAGE_SIZE)
                  const visible = item.children.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                  return (
                    <>
                      {visible.map(child => renderLink(child, true, !groupHasActiveChild && defaultActivePathSet.has(child.path)))}
                      {!collapsed && totalPages > 1 ? (
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            disabled={page === 0}
                            onClick={() => setGroupPage(item.label, page - 1)}
                            className="flex size-6 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                            aria-label="Önceki sayfa"
                          >
                            <ChevronLeft className="size-3.5" />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setGroupPage(item.label, i)}
                              className={cn(
                                'flex size-6 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                                i === page
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/50 hover:bg-white/10 hover:text-white',
                              )}
                              aria-label={`Sayfa ${i + 1}`}
                              aria-current={i === page ? 'page' : undefined}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={page === totalPages - 1}
                            onClick={() => setGroupPage(item.label, page + 1)}
                            className="flex size-6 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                            aria-label="Sonraki sayfa"
                          >
                            <ChevronRight className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            </div>
            {separator}
            </Fragment>
          )
        })}
      </nav>
    </div>
  )
}
