import { StatusPill } from '../../ui/status-pill'
import { EmptyCell } from '../../ui/EmptyCell'
import { cn } from '../../../lib/cn'

/** Dış birim çerçeve görünümü — Gittiği Yer / Talep Yeri (card #r449). */
export function FramedDepartmentStack({
  departmentName,
  secondary,
  enlarge = false,
  align = 'end',
}: {
  departmentName: string | null | undefined
  secondary?: string | null
  /** Gittiği Yer dış birimde biraz daha büyük metin. */
  enlarge?: boolean
  align?: 'end' | 'start' | 'center'
}) {
  const name = departmentName?.trim()
  if (!name && !secondary?.trim()) return <EmptyCell />

  return (
    <div className={cn(
      'flex flex-col gap-1',
      align === 'end' && 'items-end',
      align === 'start' && 'items-start',
      align === 'center' && 'items-center',
    )}
    >
      {name ? (
        <StatusPill
          tone="success"
          className={cn(
            'max-w-[14rem]',
            enlarge ? 'px-2.5 py-1 text-[0.78rem] font-semibold' : 'px-2.5 py-1 text-[0.76rem]',
          )}
        >
          <span className="truncate">{name}</span>
        </StatusPill>
      ) : null}
      {secondary?.trim() ? (
        <span className="text-xs font-semibold text-slate-500">{secondary.trim()}</span>
      ) : null}
    </div>
  )
}
