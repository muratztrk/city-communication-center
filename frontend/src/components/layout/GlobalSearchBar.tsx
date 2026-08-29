import { Building, ClipboardList, FolderKanban, ListChecks, MessageSquareMore, Search, SquareKanban, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { canAnyRoleAccessPage, getEffectiveUserRoles } from '../../lib/rolePageAccess'
import type { Department, JobSummary, SocialMessage, Task, User } from '../../types/platform'
import { ChannelIcon } from '../ui/channel-icon'
import { getCitizenRequestStatusLabel } from '../../utils/citizenRequests'
import { getTaskStatusLabel } from '../../utils/localization'
import { includesFoldedTr } from '../../utils/textNormalization'

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
  channel?: string | null
}

interface SearchData {
  myRequestJobs: JobSummary[]
  incomingJobs: JobSummary[]
  outgoingJobs: JobSummary[]
  citizenJobs: JobSummary[]
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

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function localizeSearchChannel(channel: string | null | undefined): string {
  if (!channel) return ''
  if (/^phone$/i.test(channel)) return 'Çağrı'
  return channel
}

/** Sistemde ara durumları: İşleme Alındı / Onay Bekleyen / Yapılmakta / Tamamlandı / İptal. */
function searchCitizenStatusLabel(
  t: ReturnType<typeof useTranslation>['t'],
  job: JobSummary,
): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completedShort', 'Tamamlandı')
  if (job.status === 'Cancelled' || job.status === 'Rejected') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'PendingExternalApproval' || job.status === 'PendingOwnerApproval') {
    return t('social.requestStatus.pendingApproval', 'Onay Bekleyen')
  }
  const label = getCitizenRequestStatusLabel(t, job)
  if (label.startsWith('Tamamlanan')) return label.replace('Tamamlanan', 'Tamamlandı')
  if (/işe\s*dönüşt/i.test(label) || /converted/i.test(label)) {
    return t('social.requestStatus.processingReceived', 'İşleme Alındı')
  }
  return label
}

function searchSocialStatusLabel(
  t: ReturnType<typeof useTranslation>['t'],
  status: string,
  job?: JobSummary,
): string {
  if (job) return searchCitizenStatusLabel(t, job)
  if (/complet/i.test(status)) return t('jobs.statusLabel.completedShort', 'Tamamlandı')
  if (/cancel|reject/i.test(status)) return t('jobs.statusLabel.cancelled', 'İptal')
  if (/pending|approval/i.test(status)) return t('social.requestStatus.pendingApproval', 'Onay Bekleyen')
  return t('social.requestStatus.processingReceived', 'İşleme Alındı')
}

function jobNumberTexts(job: Pick<JobSummary, 'jobNumber' | 'jobNumberYear' | 'citizenRequestNumber' | 'citizenRequestNumberYear'>): string[] {
  const parts: string[] = []
  if (job.jobNumber != null && job.jobNumberYear != null) {
    parts.push(`T-${job.jobNumberYear}-${job.jobNumber}`, `${job.jobNumberYear}-${job.jobNumber}`, String(job.jobNumber))
  }
  if (job.citizenRequestNumber != null) {
    const year = job.citizenRequestNumberYear ?? job.jobNumberYear
    parts.push(`VT-${year}-${job.citizenRequestNumber}`, String(job.citizenRequestNumber))
  }
  return parts
}

/** #3171: yalnız talep no, VT no, görev no, talep/görev başlığı, vatandaş adı, telefon. */
function jobMatches(job: JobSummary, q: string): boolean {
  const qDigits = digitsOnly(q)
  if (includesFoldedTr(job.title, q) || includesFoldedTr(job.citizenName, q)) return true
  if (jobNumberTexts(job).some(part => includesFoldedTr(part, q))) return true
  if (qDigits.length >= 3 && digitsOnly(job.citizenPhone).includes(qDigits)) return true
  return false
}

function jobSubtitle(job: JobSummary): string {
  return [
    job.ownerDepartmentName,
    job.requestType === 'ExternalUnit' ? 'Birim Dışı' : job.requestType === 'Citizen' ? 'Vatandaş' : 'Birim İçi',
  ].filter(Boolean).join(' · ')
}

function taskMatches(task: Task, q: string, parentJob?: JobSummary): boolean {
  if (includesFoldedTr(task.title, q) || includesFoldedTr(task.jobTitle, q)) return true
  if (task.taskNumber != null && task.taskNumberYear != null) {
    const no = `G-${task.taskNumberYear}-${task.taskNumber}`
    if (includesFoldedTr(no, q) || includesFoldedTr(String(task.taskNumber), q)) return true
  }
  if (task.jobNumber != null && task.jobNumberYear != null) {
    if (
      includesFoldedTr(`T-${task.jobNumberYear}-${task.jobNumber}`, q)
      || includesFoldedTr(`${task.jobNumberYear}-${task.jobNumber}`, q)
      || includesFoldedTr(String(task.jobNumber), q)
    ) return true
  }
  if (parentJob && jobNumberTexts(parentJob).some(part => includesFoldedTr(part, q))) return true
  return false
}

function socialMatches(msg: SocialMessage, q: string): boolean {
  const qDigits = digitsOnly(q)
  if (includesFoldedTr(msg.citizenHandle, q) || includesFoldedTr(msg.citizenName, q)) return true
  if (msg.citizenRequestNumber != null) {
    const year = msg.citizenRequestNumberYear
    if (includesFoldedTr(`VT-${year}-${msg.citizenRequestNumber}`, q) || includesFoldedTr(String(msg.citizenRequestNumber), q)) return true
  }
  if (qDigits.length >= 3 && digitsOnly(msg.citizenPhone).includes(qDigits)) return true
  return false
}

function resolveJobChannel(job: JobSummary, socialByJobId: Map<string, string>): string | null {
  if (job.requestType !== 'Citizen') return null
  return socialByJobId.get(job.jobId) ?? 'Phone'
}

function pushJobResults(
  results: SearchResultItem[],
  jobs: JobSummary[],
  category: SearchCategory,
  pathFor: (job: JobSummary) => string,
  seenIds: Set<string>,
  q: string,
  socialByJobId: Map<string, string>,
  showCitizenChannel: boolean,
  t: ReturnType<typeof useTranslation>['t'],
) {
  let added = 0
  for (const job of jobs) {
    if (added >= MAX_PER_CATEGORY) break
    if (seenIds.has(job.jobId) || !jobMatches(job, q)) continue
    seenIds.add(job.jobId)
    const channel = showCitizenChannel ? resolveJobChannel(job, socialByJobId) : null
    const channelLabel = localizeSearchChannel(channel)
    const status = searchCitizenStatusLabel(t, job)
    results.push({
      id: `${category}-${job.jobId}`,
      category,
      title: job.title,
      subtitle: channelLabel ? `${channelLabel} • ${status}` : jobSubtitle(job),
      path: pathFor(job),
      channel,
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
  socialByJobId: Map<string, string>,
  showCitizenChannel: boolean,
  statusOnlySubtitle: boolean,
  jobsById: Map<string, JobSummary>,
) {
  let added = 0
  for (const task of tasks) {
    if (added >= MAX_PER_CATEGORY) break
    if (seenIds.has(task.taskId) || !taskMatches(task, q, jobsById.get(task.jobId))) continue
    seenIds.add(task.taskId)
    const status = getTaskStatusLabel(t, task.currentStatus)
    results.push({
      id: `${category}-${task.taskId}`,
      category,
      title: task.title,
      subtitle: statusOnlySubtitle ? status : [task.jobTitle, status].filter(Boolean).join(' · '),
      path: pathFor(task),
      channel: showCitizenChannel && task.jobRequestType === 'Citizen'
        ? (socialByJobId.get(task.jobId) ?? (task.jobSourceType === 'SocialMessage' ? null : 'Phone'))
        : null,
    })
    added += 1
  }
}

function filterResults(
  data: SearchData,
  query: string,
  t: ReturnType<typeof useTranslation>['t'],
  access: SearchCategoryAccess,
  showCitizenChannel: boolean,
): SearchResultItem[] {
  const q = query.toLocaleLowerCase('tr').trim()
  if (q.length < 3) return []

  const results: SearchResultItem[] = []
  const seenJobs = new Set<string>()
  const seenTasks = new Set<string>()
  const socialByJobId = new Map<string, string>()
  const jobsById = new Map<string, JobSummary>()
  for (const job of [...data.citizenJobs, ...data.myRequestJobs, ...data.incomingJobs, ...data.outgoingJobs]) {
    jobsById.set(job.jobId, job)
  }
  for (const msg of data.social) {
    if (msg.jobId && msg.channel) socialByJobId.set(msg.jobId, msg.channel)
  }

  // Önce menüdeki sayfa sırasına yakın: Taleplerim → Gelen → Giden (card #1783).
  if (access.myRequests) {
    pushJobResults(
      results,
      data.myRequestJobs,
      'myRequests',
      job => `/my-requests?view=all&jobId=${job.jobId}`,
      seenJobs,
      q,
      socialByJobId,
      showCitizenChannel,
      t,
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
      socialByJobId,
      showCitizenChannel,
      t,
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
      socialByJobId,
      false,
      t,
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
      socialByJobId,
      showCitizenChannel,
      showCitizenChannel,
      jobsById,
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
      socialByJobId,
      showCitizenChannel,
      showCitizenChannel,
      jobsById,
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
      socialByJobId,
      false,
      false,
      jobsById,
    )
  }

  if (access.social) {
    data.social
      .filter(msg => socialMatches(msg, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach(msg => {
        const job = msg.jobId ? jobsById.get(msg.jobId) : undefined
        const status = searchSocialStatusLabel(t, msg.status, job)
        const channelLabel = localizeSearchChannel(msg.channel)
        results.push({
          id: `social-${msg.socialMessageId}`,
          category: 'social',
          title: msg.citizenName?.trim() || msg.citizenHandle,
          subtitle: [channelLabel, status].filter(Boolean).join(' • '),
          path: `/social?channel=${msg.channel}`,
          channel: msg.channel,
        })
      })
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

  const showCitizenChannel = !roles.includes('Operator') && !roles.includes('SystemAdmin')

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
        citizenJobs,
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
        access.social
          ? api.getJobs('all', null, 'Citizen').catch(() => [] as JobSummary[])
          : Promise.resolve([] as JobSummary[]),
        access.myTasks ? api.getTasks('mine').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        access.departmentTasks ? api.getTasks('department').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        access.staffTasks ? api.getTasks('all').catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
        (access.social || showCitizenChannel)
          ? Promise.allSettled([api.getSocialMessages()])
          : Promise.allSettled([Promise.resolve([] as SocialMessage[])]),
        Promise.allSettled([Promise.resolve([] as User[])]),
        Promise.allSettled([Promise.resolve([] as Department[])]),
      ])

      const fetched: SearchData = {
        myRequestJobs,
        incomingJobs,
        outgoingJobs,
        citizenJobs,
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
    access.departmentTasks,
    access.incomingRequests,
    access.myRequests,
    access.myTasks,
    access.outgoingRequests,
    access.social,
    access.staffTasks,
    data,
    showCitizenChannel,
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
      setResults(filterResults(current, value, t, access, showCitizenChannel))
    }, 300)
  }, [access, data, fetchData, showCitizenChannel, t])

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
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 shadow-sm transition-shadow focus-within:border-slate-300 focus-within:shadow-md">
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
          className="w-[8.25rem] bg-transparent text-xs font-normal text-slate-700 placeholder:text-slate-400 outline-none"
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
                    {items.map(item => {
                      const iconBesideTitle = Boolean(item.channel) && (
                        item.category === 'incomingRequests'
                        || item.category === 'myTasks'
                        || item.category === 'departmentTasks'
                      )
                      const iconBesideChannel = Boolean(item.channel) && !iconBesideTitle
                      return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-start gap-2 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                        onClick={() => handleSelect(item.path)}
                      >
                        {iconBesideTitle && item.channel ? (
                          <ChannelIcon channel={item.channel} className="mt-px size-3.5 shrink-0 self-center" />
                        ) : null}
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                          {item.subtitle ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              {iconBesideChannel && item.channel ? (
                                <ChannelIcon channel={item.channel} className="size-3.5 shrink-0" />
                              ) : null}
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      )
                    })}
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
