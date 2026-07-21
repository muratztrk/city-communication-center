import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { UserLookup } from '../../types/platform'

interface ExtensionSearchResult {
  userId: string
  title: string
  subtitle: string
}

/** Yalnız Unicode harf + boşluk (card #1776 reopen — rakam/noktalama yok). */
function lettersOnly(value: string): string {
  return value.replace(/[^\p{L}\s]/gu, '')
}

/** Header “Personel Dahili No ara…” — tüm kullanıcılara açık (cards #1770/#1779/#1780). */
export function ExtensionSearchBar() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ExtensionSearchResult[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const mapResults = useCallback((list: UserLookup[]): ExtensionSearchResult[] => (
    list.map(userItem => {
      const titleParts = [userItem.displayName, userItem.phone].filter(Boolean)
      const subtitleParts = [userItem.departmentName, userItem.title].filter(Boolean)
      return {
        userId: userItem.userId,
        title: titleParts.join(' - '),
        subtitle: subtitleParts.join(' - '),
      }
    })
  ), [])

  const handleInput = useCallback((raw: string) => {
    const value = lettersOnly(raw)
    setQuery(value)
    clearTimeout(debounceRef.current)

    if (value.trim().length < 3) {
      requestIdRef.current += 1
      setResults([])
      setIsOpen(false)
      setIsLoading(false)
      return
    }

    setIsOpen(true)
    setIsLoading(true)
    const requestId = ++requestIdRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        // Yalnız DisplayName eşleşmesi (card #1780); tüm roller erişebilir (card #1779).
        const list = await api.searchUsers(value.trim(), undefined, true)
        if (requestId !== requestIdRef.current) return
        setResults(mapResults(list))
      } catch {
        if (requestId !== requestIdRef.current) return
        setResults([])
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false)
      }
    }, 300)
  }, [mapResults])

  const clear = () => {
    clearTimeout(debounceRef.current)
    requestIdRef.current += 1
    setQuery('')
    setResults([])
    setIsOpen(false)
    setIsLoading(false)
    // focus() onFocus'ta stale results ile paneli yeniden açmasın (card #1781).
  }

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
          inputMode="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 3 && results.length > 0) setIsOpen(true)
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              clearTimeout(debounceRef.current)
              requestIdRef.current += 1
              setIsOpen(false)
              setQuery('')
              setResults([])
              setIsLoading(false)
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

      {showPanel ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
          {isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
          ) : showEmpty ? (
            <div className="px-4 py-4 text-sm text-slate-400">{t('search.noResults', 'Sonuç bulunamadı')}</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 text-[color:var(--color-primary)]" />
                <span className="text-sm font-bold tracking-[0.04em] text-[color:var(--color-primary)]">
                  {t('search.extensionResults', 'Personel')}
                </span>
              </div>
              {results.map(item => (
                <div
                  key={item.userId}
                  className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 last:border-0"
                >
                  <span className="text-base font-semibold text-slate-800">{item.title}</span>
                  {item.subtitle ? <span className="text-sm text-slate-500">{item.subtitle}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
