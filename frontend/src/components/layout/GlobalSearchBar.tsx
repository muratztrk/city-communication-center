import { Building, FolderKanban, ListChecks, MessageSquareMore, Search, Users, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Department, JobSummary, SocialMessage, Task, User } from '../../types/platform'
import { getTaskStatusLabel } from '../../utils/localization'

interface SearchResultItem {
  id: string
  category: 'jobs' | 'tasks' | 'social' | 'users' | 'departments'
  title: string
  subtitle: string
  path: string
}

interface SearchData {
  jobs: JobSummary[]
  tasks: Task[]
  social: SocialMessage[]
  users: User[]
  departments: Department[]
}

const CATEGORY_ICONS = {
  jobs: FolderKanban,
  tasks: ListChecks,
  social: MessageSquareMore,
  users: Users,
  departments: Building,
} as const

const MAX_PER_CATEGORY = 4

function filterResults(
  data: SearchData,
  query: string,
  t: ReturnType<typeof useTranslation>['t'],
): SearchResultItem[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const results: SearchResultItem[] = []

  data.jobs
    .filter(job =>
      job.title.toLowerCase().includes(q)
      || job.citizenName?.toLowerCase().includes(q)
      || job.ownerDepartmentName?.toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_CATEGORY)
    .forEach(job => results.push({
      id: `job-${job.jobId}`,
      category: 'jobs',
      title: job.title,
      subtitle: [job.ownerDepartmentName, job.requestType === 'ExternalUnit' ? 'Birim Dışı' : job.requestType === 'Citizen' ? 'Vatandaş' : 'Birim İçi'].filter(Boolean).join(' · '),
      path: job.requestType === 'ExternalUnit' ? '/jobs' : '/incoming-requests?kind=all',
    }))

  data.tasks
    .filter(task =>
      task.title.toLowerCase().includes(q)
      || task.jobTitle?.toLowerCase().includes(q)
      || task.assignedUserDisplayName?.toLowerCase().includes(q)
      || task.assignedDepartmentName?.toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_CATEGORY)
    .forEach(task => results.push({
      id: `task-${task.taskId}`,
      category: 'tasks',
      title: task.title,
      subtitle: [task.jobTitle, getTaskStatusLabel(t, task.currentStatus)].filter(Boolean).join(' · '),
      path: '/my-tasks?view=all',
    }))

  data.social
    .filter(msg =>
      msg.citizenHandle.toLowerCase().includes(q)
      || msg.category?.toLowerCase().includes(q)
      || msg.assignedDepartmentName?.toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_CATEGORY)
    .forEach(msg => results.push({
      id: `social-${msg.socialMessageId}`,
      category: 'social',
      title: `@${msg.citizenHandle}`,
      subtitle: [msg.channel, msg.category].filter(Boolean).join(' · '),
      path: `/social?channel=${msg.channel}`,
    }))

  data.users
    .filter(user =>
      user.displayName.toLowerCase().includes(q)
      || user.username?.toLowerCase().includes(q)
      || user.email?.toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_CATEGORY)
    .forEach(user => results.push({
      id: `user-${user.userId}`,
      category: 'users',
      title: user.displayName,
      subtitle: [user.title, user.email].filter(Boolean).join(' · '),
      path: '/users',
    }))

  data.departments
    .filter(dept => dept.name.toLowerCase().includes(q))
    .slice(0, MAX_PER_CATEGORY)
    .forEach(dept => results.push({
      id: `dept-${dept.departmentId}`,
      category: 'departments',
      title: dept.name,
      subtitle: dept.departmentType,
      path: '/departments',
    }))

  return results
}

export function GlobalSearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<SearchData | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fetchedRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = useCallback(async (): Promise<SearchData | null> => {
    if (fetchedRef.current && data) return data
    fetchedRef.current = true
    setIsLoading(true)
    try {
      const [jobsResult, tasksResult, socialResult, usersResult, depsResult] = await Promise.allSettled([
        api.getJobs('all'),
        api.getTasks('all'),
        api.getSocialMessages(),
        api.getUsers(),
        api.getDepartments(),
      ])
      const fetched: SearchData = {
        jobs: jobsResult.status === 'fulfilled' ? jobsResult.value : [],
        tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : [],
        social: socialResult.status === 'fulfilled' ? socialResult.value : [],
        users: usersResult.status === 'fulfilled' ? usersResult.value : [],
        departments: depsResult.status === 'fulfilled' ? depsResult.value : [],
      }
      setData(fetched)
      return fetched
    } catch {
      fetchedRef.current = false
      return null
    } finally {
      setIsLoading(false)
    }
  }, [data])

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    debounceRef.current = setTimeout(async () => {
      const current = data ?? await fetchData()
      if (!current) return
      setResults(filterResults(current, value, t))
    }, 300)
  }, [data, fetchData, t])

  const handleSelect = (path: string) => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    navigate(path)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const categoryLabels: Record<string, string> = {
    jobs: t('nav.jobs', 'İşler'),
    tasks: t('nav.tasks', 'Görevler'),
    social: t('nav.social', 'Sosyal'),
    users: t('nav.users', 'Kullanıcılar'),
    departments: t('nav.departments', 'Birimler'),
  }

  const groupedResults = results.reduce<Record<string, SearchResultItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const hasResults = results.length > 0
  const showEmpty = isOpen && !isLoading && query.trim() && !hasResults

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-sm transition-shadow focus-within:border-slate-300 focus-within:shadow-md">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }
          }}
          placeholder={t('search.placeholder', 'Sistemde ara...')}
          className="w-44 bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none"
          aria-label={t('search.label', 'Sistemde ara')}
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" onClick={clear} className="shrink-0 font-extrabold text-red-500 hover:text-red-600" aria-label="Temizle">
            <X className="size-3.5" strokeWidth={3} />
          </button>
        ) : null}
      </div>

      {(isOpen || showEmpty) ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
          ) : showEmpty ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('search.noResults', 'Sonuç bulunamadı')}</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {Object.entries(groupedResults).map(([category, items]) => {
                const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]
                return (
                  <div key={category}>
                    <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <Icon className="size-3.5 text-slate-400" />
                      <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">{categoryLabels[category]}</span>
                    </div>
                    {items.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                        onClick={() => handleSelect(item.path)}
                      >
                        <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                        {item.subtitle ? <span className="text-xs text-slate-400">{item.subtitle}</span> : null}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
