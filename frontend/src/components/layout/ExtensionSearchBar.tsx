import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { canAnyRoleAccessPage, getEffectiveUserRoles } from '../../lib/rolePageAccess'
import type { User } from '../../types/platform'

interface ExtensionSearchResult {
  userId: string
  title: string
  subtitle: string
}

const MAX_RESULTS = 12

function primaryDepartmentName(user: User): string {
  const primary = user.departments?.find(department => department.isPrimary)
  return primary?.name ?? user.departments?.[0]?.name ?? ''
}

function matchesPhone(phone: string | null | undefined, query: string): boolean {
  if (!phone) return false
  const normalizedPhone = phone.toLocaleLowerCase('tr')
  const digitsPhone = phone.replace(/\D/g, '')
  const digitsQuery = query.replace(/\D/g, '')
  return normalizedPhone.includes(query)
    || (digitsQuery.length >= 3 && digitsPhone.includes(digitsQuery))
}

/** Header “Dahili No ara…” — Sistemde ara’nın solunda aynı tasarım (card #1770). */
export function ExtensionSearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canSearchUsers = useMemo(
    () => canAnyRoleAccessPage(getEffectiveUserRoles(user), 'users'),
    [user],
  )
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [users, setUsers] = useState<User[] | null>(null)
  const [results, setResults] = useState<ExtensionSearchResult[]>([])
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

  const fetchUsers = useCallback(async (): Promise<User[] | null> => {
    if (!canSearchUsers) return []
    if (fetchedRef.current && users) return users
    fetchedRef.current = true
    setIsLoading(true)
    try {
      const list = await api.getUsers()
      setUsers(list)
      return list
    } catch {
      fetchedRef.current = false
      return null
    } finally {
      setIsLoading(false)
    }
  }, [canSearchUsers, users])

  const filterUsers = useCallback((list: User[], value: string): ExtensionSearchResult[] => {
    const q = value.toLocaleLowerCase('tr').trim()
    if (q.length < 3) return []

    return list
      .filter(userItem =>
        matchesPhone(userItem.phone, q)
        || userItem.displayName.toLocaleLowerCase('tr').includes(q)
        || userItem.username?.toLocaleLowerCase('tr').includes(q)
        || userItem.title?.toLocaleLowerCase('tr').includes(q),
      )
      .slice(0, MAX_RESULTS)
      .map(userItem => {
        const department = primaryDepartmentName(userItem)
        const titleParts = [userItem.displayName, userItem.phone].filter(Boolean)
        const subtitleParts = [department, userItem.title].filter(Boolean)
        return {
          userId: userItem.userId,
          title: titleParts.join(' - '),
          subtitle: subtitleParts.join(' - '),
        }
      })
  }, [])

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)

    if (!canSearchUsers || value.trim().length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    debounceRef.current = setTimeout(async () => {
      const list = users ?? await fetchUsers()
      if (!list) return
      setResults(filterUsers(list, value))
    }, 300)
  }, [canSearchUsers, fetchUsers, filterUsers, users])

  if (!canSearchUsers) {
    return null
  }

  const handleSelect = () => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    navigate('/users')
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const hasResults = results.length > 0
  const showEmpty = isOpen && !isLoading && query.trim().length >= 3 && !hasResults

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
          placeholder={t('search.extensionPlaceholder', 'Personel Dahili No ara...')}
          className="w-44 bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none"
          aria-label={t('search.extensionLabel', 'Personel Dahili No ara')}
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
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <Search className="size-3.5 text-slate-400" />
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {t('search.extensionResults', 'Dahili No')}
                </span>
              </div>
              {results.map(item => (
                <button
                  key={item.userId}
                  type="button"
                  className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                  onClick={() => handleSelect()}
                >
                  <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                  {item.subtitle ? <span className="text-xs text-slate-400">{item.subtitle}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
