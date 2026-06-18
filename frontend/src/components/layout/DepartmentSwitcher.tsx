import { Building2, Check, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'
import { getActiveDepartmentId, setActiveDepartmentId } from '../../api/http'
import type { DepartmentSummary } from '../../types/platform'

export function DepartmentSwitcher() {
  const { t } = useTranslation()
  const [activeDeptId, setActiveDeptId] = useState<string | null>(getActiveDepartmentId)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments.me(),
    queryFn: () => api.getMyDepartments(),
  })
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])

  useEffect(() => {
    if (!departmentsQuery.data) return
    const currentDeptId = getActiveDepartmentId()

    if (departments.length > 0 && (!currentDeptId || !departments.some(dept => dept.departmentId === currentDeptId))) {
      const primary = departments.find(d => d.isPrimary) ?? departments[0]
      setActiveDepartmentId(primary.departmentId)
      const frame = window.requestAnimationFrame(() => setActiveDeptId(primary.departmentId))
      return () => window.cancelAnimationFrame(frame)
    }

    const frame = window.requestAnimationFrame(() => setActiveDeptId(currentDeptId))
    return () => window.cancelAnimationFrame(frame)
  }, [departments, departmentsQuery.data])

  useEffect(() => {
    const handler = () => setActiveDeptId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (departments.length <= 1) return null

  const activeDept = departments.find(d => d.departmentId === activeDeptId) ?? departments[0]

  const handleSelect = (dept: DepartmentSummary) => {
    setActiveDepartmentId(dept.departmentId)
    setActiveDeptId(dept.departmentId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={t('departmentSwitcher.tooltip', 'Aktif birimi değiştir')}
      >
        <Building2 className="size-4 shrink-0 text-[color:var(--color-primary)]" />
        <span className="max-w-[160px] truncate text-sm font-semibold text-slate-700">{activeDept.name}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label={t('departmentSwitcher.label', 'Birim seçin')}
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
        >
          <div className="px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">
            {t('departmentSwitcher.heading', 'Görev Yaptığım Birimler')}
          </div>
          <div className="pb-1.5">
            {departments.map(dept => {
              const isActive = dept.departmentId === activeDeptId
              return (
                <button
                  key={dept.departmentId}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => handleSelect(dept)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/10">
                    <Building2 className="size-4 text-[color:var(--color-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{dept.name}</div>
                    {dept.isPrimary ? (
                      <div className="text-xs text-slate-400">{t('departmentSwitcher.primaryLabel', 'Asıl Birim')}</div>
                    ) : null}
                  </div>
                  {isActive ? <Check className="size-4 shrink-0 text-[color:var(--color-primary)]" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
