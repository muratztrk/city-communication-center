import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { RequestTag } from '../types/platform'
import { Button } from './ui/button'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ModalBackdrop } from './ui/modal-backdrop'
import { ModalCloseButton } from './ui/modal-close-button'
import { SingleSelectDropdown } from './ui/single-select-dropdown'

interface RequestTagDialogProps {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export function RequestTagDialog({ open, onClose, onChanged }: RequestTagDialogProps) {
  const { t } = useTranslation()
  const [tags, setTags] = useState<RequestTag[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const loadTags = async () => {
    setLoading(true)
    setError(null)
    try {
      setTags(await api.getRequestTags())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setName('')
    setSelectedId(null)
    void loadTags()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    setSaving(true)
    setError(null)
    try {
      await api.createRequestTag(trimmedName)
      setName('')
      await loadTags()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = () => {
    if (!selectedId) return
    setConfirmDialog({
      title: t('whatsapp.requestTagDeleteTitle', 'Etiketi Sil'),
      titleDivider: true,
      message: t('whatsapp.requestTagDeleteConfirm', 'Bu etiketi silmek istediğinize emin misiniz?'),
      confirmLabel: t('common.delete', 'Sil'),
      variant: 'destructive',
      onConfirm: () => void handleDelete(),
    })
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      await api.deleteRequestTag(selectedId)
      setSelectedId(null)
      await loadTags()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <ModalBackdrop>
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">
            {t('whatsapp.requestTagsTitle', 'Talep etiketleri')}
          </h2>
          <ModalCloseButton onClick={onClose} label={t('common.close', 'Kapat')} />
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">
              {t('whatsapp.addRequestTag', 'Yeni etiket ekle')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder={t('whatsapp.requestTagName', 'Etiket adı')}
                className="field-input w-full text-sm"
              />
              <Button
                type="button"
                size="sm"
                disabled={saving || !name.trim()}
                onClick={() => void handleAdd()}
              >
                {t('common.add', 'Ekle')}
              </Button>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">
                {t('whatsapp.requestTagList', 'Kayıtlı etiketler')}
              </span>
              <SingleSelectDropdown
                options={tags.map(tag => ({ value: tag.tagId, label: tag.name }))}
                value={selectedId ?? ''}
                onChange={nextValue => setSelectedId(nextValue || null)}
                placeholder={
                  loading
                    ? t('common.loading', 'Yükleniyor…')
                    : tags.length === 0
                      ? t('whatsapp.noRequestTags', 'Henüz etiket yok.')
                      : t('whatsapp.selectRequestTag', 'Etiket seçin…')
                }
                emptyText={t('whatsapp.noRequestTags', 'Henüz etiket yok.')}
                disabled={loading}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!selectedId || saving}
                onClick={handleDeleteConfirm}
              >
                <Trash2 className="size-3.5" />
                {t('common.delete', 'Sil')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </ModalBackdrop>,
    document.body,
  )
}

interface RequestTagAddButtonProps {
  onChanged?: () => void
  largeText?: boolean
}

export function RequestTagAddButton({ onChanged, largeText = false }: RequestTagAddButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${largeText ? 'text-sm' : 'text-xs'}`}
      >
        <Plus className="size-3.5 text-emerald-600" aria-hidden="true" />
        {t('whatsapp.addRequestTagButton', 'Etiket ekle')}
      </button>
      <RequestTagDialog
        open={open}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </>
  )
}

interface RequestTagPickerProps {
  tags: RequestTag[]
  onSelect: (name: string) => void
  largeText?: boolean
}

function computeTagMenuStyle(button: HTMLDivElement, itemCount: number, hasSearch: boolean) {
  const rect = button.getBoundingClientRect()
  const menuWidth = 224
  const menuHeight = Math.min(224, itemCount * 40) + (hasSearch ? 40 : 0)
  const openUp = rect.top >= menuHeight + 8
  const left = Math.min(rect.left, window.innerWidth - menuWidth - 8)
  return {
    top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
    left,
    width: menuWidth,
  }
}

// "Şablon mesajlar" (WhatsAppTemplatePicker) ile aynı buton+portal açılış davranışı — bir
// SingleSelectDropdown yerine, seçim yapılınca kapanan basit bir menü butonu (kart #1510).
export function RequestTagPicker({ tags, onSelect, largeText = false }: RequestTagPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const buttonRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const sorted = useMemo(
    () => [...tags].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [tags],
  )
  const searchable = sorted.length >= 7
  const normalizedSearch = search.trim().toLocaleLowerCase('tr')
  const visibleTags = useMemo(
    () => normalizedSearch
      ? sorted.filter(tag => tag.name.toLocaleLowerCase('tr').includes(normalizedSearch))
      : sorted,
    [normalizedSearch, sorted],
  )

  useLayoutEffect(() => {
    if (open && menuRef.current) {
      menuRef.current.scrollTop = 0
    }
  }, [open, menuStyle])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
      setMenuStyle(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const isEmpty = sorted.length === 0

  const toggleOpen = () => {
    if (isEmpty) return
    if (open) {
      setOpen(false)
      setMenuStyle(null)
      return
    }
    if (buttonRef.current) {
      setMenuStyle(computeTagMenuStyle(buttonRef.current, sorted.length, searchable))
    }
    setOpen(true)
  }

  const menu = open && menuStyle ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg"
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
    >
      {searchable ? (
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
          <Search className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t('common.search', 'Ara...')}
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      ) : null}
      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {visibleTags.length === 0 ? (
          <p className="px-3 py-2 text-xs font-semibold text-slate-500">{t('common.noResults', 'Sonuç bulunamadı.')}</p>
        ) : visibleTags.map(tag => (
          <button
            key={tag.tagId}
            type="button"
            onClick={() => { onSelect(tag.name); setOpen(false); setSearch(''); setMenuStyle(null) }}
            className="w-full truncate px-3 py-2 text-left text-xs font-semibold text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface-raised)]"
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <div className="relative min-w-0 flex-1" ref={buttonRef}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={toggleOpen}
        disabled={isEmpty}
        className={`h-9 w-full gap-1.5 disabled:opacity-50 ${largeText ? 'text-sm' : 'text-xs'}`}
      >
        <Tag className="size-3.5 text-emerald-600" />
        {t('whatsapp.requestTagsShort', 'Etiketler')}
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {menu}
    </div>
  )
}
