import { Building, ClipboardList, FolderKanban, ListChecks, MessageSquareMore, Search, SquareKanban, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { canAnyRoleAccessPage, getEffectiveUserRoles } from '../../lib/rolePageAccess'
import type { Department, JobSummary, SocialMessage, Task, User } from '../../types/platform'
import { getTaskStatusLabel } from '../../utils/localization'

type SearchCategory =
  | 'myRequests'
  | 'incomingRequests'
  | 'outgoingRequests'
  | 'myTasks'
  | 'departmentTasks'
  | 'staffTasks'
  | 'social'
  | 'users'
  | 'departments'

interface SearchResultItem {
  id: string
  category: SearchCategory
  title: string
  subtitle: string
  path: string
}

interface SearchData {
  myRequestJobs: JobSummary[]
  incomingJobs: JobSummary[]
  outgoingJobs: JobSummary[]
  myTasks: Task[]
  departmentTasks: Task[]
  staffTasks: Task[]
  social: SocialMessage[]
  users: User[]
  departments: Department[]
}

interface SearchCategoryAccess {
  myRequests: boolean
  incomingRequests: boolean
  outgoingRequests: boolean
  myTasks: boolean
  departmentTasks: boolean
  staffTasks: boolean
  social: boolean
  users: boolean
  departments: boolean
}

const CATEGORY_ICONS: Record<SearchCategory, typeof FolderKanban> = {
  myRequests: ClipboardList,
  incomingRequests: FolderKanban,
  outgoingRequests: FolderKanban,
  myTasks: ListChecks,
  departmentTasks: SquareKanban,
  staffTasks: Users,
  social: MessageSquareMore,
  users: Users,
  departments: Building,
}

const MAX_PER_CATEGORY = 4

function jobMatches(job: JobSummary, q: string): boolean {
  return job.title.toLocaleLowerCase('tr').includes(q)
    || job.citizenName?.toLocaleLowerCase('tr').includes(q)
    || job.ownerDepartmentName?.toLocaleLowerCase('tr').includes(q)
    || false
}

function jobSubtitle(job: JobSummary): string {
  return [
    job.ownerDepartmentName,
    job.requestType === 'ExternalUnit' ? 'Birim Dışı' : job.requestType === 'Citizen' ? 'Vatandaş' : 'Birim İçi',
  ].filter(Boolean).join(' · ')
}

function taskMatches(task: Task, q: string): boolean {
  return task.title.toLocaleLowerCase('tr').includes(q)
    || task.jobTitle?.toLocaleLowerCase('tr').includes(q)
    || task.assignedUserDisplayName?.toLocaleLowerCase('tr').includes(q)
    || task.assignedDepartmentName?.toLocaleLowerCase('tr').includes(q)
    || false
}

function pushJobResults(
  results: SearchResultItem[],
  jobs: JobSummary[],
  category: SearchCategory,
  pathFor: (job: JobSummary) => string,
  seenIds: Set<string>,
  q: string,
) {
  let added = 0
  for (const job of jobs) {
    if (added >= MAX_PER_CATEGORY) break
    if (seenIds.has(job.jobId) || !jobMatches(job, q)) continue
    seenIds.add(job.jobId)
    results.push({
      id: `${category}-${job.jobId}`,
      category,
      title: job.title,
      subtitle: jobSubtitle(job),
      path: pathFor(job),
    })
    added += 1
  }
}

function pushTaskResults(
  results: SearchResultItem[],
  tasks: Task[],
  category: SearchCategory,
  pathFor: (task: Task) => string,
  seenIds: Set<string>,
  q: string,
  t: ReturnType<typeof useTranslation>['t'],
) {
  let added = 0
  for (const task of tasks) {
    if (added >= MAX_PER_CATEGORY) break
    if (seenIds.has(task.taskId) || !taskMatches(task, q)) continue
    seenIds.add(task.taskId)
    results.push({
      id: `${category}-${task.taskId}`,
      category,
      title: task.title,
      subtitle: [task.jobTitle, getTaskStatusLabel(t, task.currentStatus)].filter(Boolean).join(' · '),
      path: pathFor(task),
    })
    added += 1
  }
}

function filterResults(
  data: SearchData,
  query: string,
  t: ReturnType<typeof useTranslation>['t'],
  access: SearchCategoryAccess,
): SearchResultItem[] {
  const q = query.toLocaleLowerCase('tr').trim()
  if (q.length < 3) return []

  const results: SearchResultItem[] = []
  const seenJobs = new Set<string>()
  const seenTasks = new Set<string>()

  // Önce menüdeki sayfa sırasına yakın: Taleplerim → Gelen → Giden (card #1783).
  if (access.myRequests) {
    pushJobResults(
      results,
      data.myRequestJobs,
      'myRequests',
      job => `/my-requests?view=all&jobId=${job.jobId}`,
      seenJobs,
      q,
    )
  }
  if (access.incomingRequests) {
    pushJobResults(
      results,
      data.incomingJobs,
      'incomingRequests',
      job => `/request-details?context=incoming&jobId=${job.jobId}`,
      seenJobs,
      q,
    )
  }
  if (access.outgoingRequests) {
    pushJobResults(
      results,
      data.outgoingJobs,
      'outgoingRequests',
      job => `/outgoing-requests?jobId=${job.jobId}`,
      seenJobs,
      q,
    )
  }

  if (access.myTasks) {
    pushTaskResults(
      results,
      data.myTasks,
      'myTasks',
      task => `/my-tasks?view=all&taskId=${task.taskId}`,
      seenTasks,
      q,
      t,
    )
  }
  if (access.departmentTasks) {
    pushTaskResults(
      results,
      data.departmentTasks,
      'departmentTasks',
      task => `/department-tasks?flow=all&taskId=${task.taskId}`,
      seenTasks,
      q,
      t,
    )
  }
  if (access.staffTasks) {
    pushTaskResults(
      results,
      data.staffTasks,
      'staffTasks',
      task => `/staff-tasks?taskId=${task.taskId}`,
      seenTasks,
      q,
      t,
    )
  }

  if (access.social) {
    data.social
      .filter(msg =>
        msg.citizenHandle.toLocaleLowerCase('tr').includes(q)
        || msg.category?.toLocaleLowerCase('tr').includes(q)
        || msg.assignedDepartmentName?.toLocaleLowerCase('tr').includes(q),
      )
      .slice(0, MAX_PER_CATEGORY)
      .forEach(msg => results.push({
        id: `social-${msg.socialMessageId}`,
        category: 'social',
        title: `@${msg.citizenHandle}`,
        subtitle: [msg.channel, msg.category].filter(Boolean).join(' · '),
        path: `/social?channel=${msg.channel}`,
      }))
  }

  if (access.users) {
    data.users
      .filter(user =>
        user.displayName.toLocaleLowerCase('tr').includes(q)
        || user.username?.toLocaleLowerCase('tr').includes(q)
        || user.email?.toLocaleLowerCase('tr').includes(q),
      )
      .slice(0, MAX_PER_CATEGORY)
      .forEach(user => results.push({
        id: `user-${user.userId}`,
        category: 'users',
        title: user.displayName,
        subtitle: [user.title, user.email].filter(Boolean).join(' · '),
        path: '/users',
      }))
  }

  if (access.departments) {
    data.departments
      .filter(dept => dept.name.toLocaleLowerCase('tr').includes(q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach(dept => results.push({
        id: `dept-${dept.departmentId}`,
        category: 'departments',
        title: dept.name,
        subtitle: dept.departmentType,
        path: '/departments',
      }))
  }

  return results
}

export function GlobalSearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const roles = useMemo(() => getEffectiveUserRoles(user), [user])
  const access = useMemo<SearchCategoryAccess>(() => {
    const myRequests = canAnyRoleAccessPage(roles, 'myRequests')
    const incomingRequests = canAnyRoleAccessPage(roles, 'incomingRequests')
    const outgoingRequests = canAnyRoleAccessPage(roles, 'outgoingRequests')
    const myTasks = canAnyRoleAccessPage(roles, 'myTasks')
    const departmentTasks = canAnyRoleAccessPage(roles, 'departmentTasks')
    const staffTasks = user?.role === 'Manager' || user?.role === 'SystemAdmin'
    return {
      myRequests,
      incomingRequests,
      outgoingRequests,
      myTasks,
      departmentTasks,
      staffTasks,
      social: canAnyRoleAccessPage(roles, 'social'),
      users: canAnyRoleAccessPage(roles, 'users'),
      departments: canAnyRoleAccessPage(roles, 'departments'),
    }
  }, [roles, user?.role])

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

  // Yetki değişince önbelleği sıfırla (cards #1766/#1782/#1783).
  useEffect(() => {
    fetchedRef.current = false
    setData(null)
    setResults([])
  }, [
    access.myRequests,
    access.incomingRequests,
    access.outgoingRequests,
    access.myTasks,
    access.departmentTasks,
    access.staffTasks,
    access.social,
    access.users,
    access.departments,
  ])

  const fetchData = useCallback(async (): Promise<SearchData | null> => {
    if (fetchedRef.current && data) return data
    fetchedRef.current = true
    setIsLoading(true)
    try {
      // Sayfa yetkisine göre ayrı bucket — kategori başlığı menü adıyla aynı (card #1783).
      const [
        myRequestJobs,
        incomingJobs,
        outgoingJobs,
        myTasks,
        departmentTasks,
        staffTasks,
        socialSettled,
        usersSettled,
        depsSettled,
      ] = await Promise.all([
        access.myRequests ? api.getJobs('mine').catch(() => [] as JobSummary[]) : Promise.resolve([] as JobSummary[]),
        access.incomingRequests ? api.getJobs('my-department').catch(() => [] as JobSummary[]) : Promise.resolve([] as JobSummary[]),
        access.outgoingRequests ? api.getJobs('outgoing-department').catch(() => [] as JobSummary[]) : Promise.resolve([] as JobSummary[]),
        access.myTasks ? api.getTasks('mine').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        access.departmentTasks ? api.getTasks('department').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        access.staffTasks ? api.getTasks('all').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        Promise.allSettled([access.social ? api.getSocialMessages() : Promise.resolve([] as SocialMessage[])]),
        Promise.allSettled([access.users ? api.getUsers() : Promise.resolve([] as User[])]),
        Promise.allSettled([access.departments ? api.getDepartments() : Promise.resolve([] as Department[])]),
      ])

      const fetched: SearchData = {
        myRequestJobs,
        incomingJobs,
        outgoingJobs,
        myTasks,
        departmentTasks,
        staffTasks,
        social: socialSettled[0]?.status === 'fulfilled' ? socialSettled[0].value : [],
        users: usersSettled[0]?.status === 'fulfilled' ? usersSettled[0].value : [],
        departments: depsSettled[0]?.status === 'fulfilled' ? depsSettled[0].value : [],
      }
      setData(fetched)
      return fetched
    } catch {
      fetchedRef.current = false
      return null
    } finally {
      setIsLoading(false)
    }
  }, [
    access.departments,
    access.departmentTasks,
    access.incomingRequests,
    access.myRequests,
    access.myTasks,
    access.outgoingRequests,
    access.social,
    access.staffTasks,
    access.users,
    data,
  ])

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    debounceRef.current = setTimeout(async () => {
      const current = data ?? await fetchData()
      if (!current) return
      setResults(filterResults(current, value, t, access))
    }, 300)
  }, [access, data, fetchData, t])

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
  }

  // Kategori başlığı = sol menü sayfa adı (card #1783; nav.jobs = "Birime Gelen…" kullanılmaz).
  const categoryLabels: Record<SearchCategory, string> = {
    myRequests: t('nav.myRequests', 'Taleplerim'),
    incomingRequests: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    outgoingRequests: t('nav.outgoingRequests', 'Birimden Giden Talepler'),
    myTasks: t('nav.myTasks', 'Görevlerim'),
    departmentTasks: t('nav.departmentTasks', 'Birimdeki Görevler'),
    staffTasks: t('nav.staffTasks', 'Personelimin Görevleri'),
    social: t('nav.social', 'Sosyal'),
    users: t('nav.users', 'Kullanıcılar'),
    departments: t('nav.departments', 'Birimler'),
  }

  const categoryOrder: SearchCategory[] = [
    'myRequests',
    'incomingRequests',
    'outgoingRequests',
    'myTasks',
    'departmentTasks',
    'staffTasks',
    'social',
    'users',
    'departments',
  ]

  const groupedResults = categoryOrder
    .map(category => [category, results.filter(item => item.category === category)] as const)
    .filter(([, items]) => items.length > 0)

  const hasResults = results.length > 0
  const showEmpty = isOpen && !isLoading && query.trim().length >= 3 && !hasResults
  const showPanel = isOpen && (isLoading || hasResults || showEmpty)

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

      {showPanel ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
          ) : showEmpty ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('search.noResults', 'Sonuç bulunamadı')}</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {groupedResults.map(([category, items]) => {
                const Icon = CATEGORY_ICONS[category]
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
