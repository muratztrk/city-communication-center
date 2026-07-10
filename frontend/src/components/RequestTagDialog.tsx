import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { RequestTag } from '../types/platform'
import { Button } from './ui/button'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ModalBackdrop } from './ui/modal-backdrop'
import { ModalCloseButton } from './ui/modal-close-button'

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

  const handleDeleteConfirm = (tag: RequestTag) => {
    setConfirmDialog({
      title: t('whatsapp.requestTagDeleteTitle', 'Etiketi Sil'),
      titleDivider: true,
      message: t('whatsapp.requestTagDeleteConfirm', 'Bu etiketi silmek istediğinize emin misiniz?'),
      confirmLabel: t('common.delete', 'Sil'),
      variant: 'destructive',
      onConfirm: () => void handleDelete(tag.tagId),
    })
  }

  const handleDelete = async (tagId: string) => {
    setSaving(true)
    setError(null)
    try {
      await api.deleteRequestTag(tagId)
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

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">
                {t('whatsapp.requestTagList', 'Kayıtlı etiketler')}
              </p>
              {loading ? (
                <p className="text-sm text-slate-500">{t('common.loading', 'Yükleniyor…')}</p>
              ) : tags.length === 0 ? (
                <p className="text-sm text-slate-500">{t('whatsapp.noRequestTags', 'Henüz etiket yok.')}</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {tags.map(tag => (
                    <li key={tag.tagId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-sm text-slate-800">{tag.name}</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={saving}
                        onClick={() => handleDeleteConfirm(tag)}
                        aria-label={t('common.delete', 'Sil')}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
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
}

export function RequestTagAddButton({ onChanged }: RequestTagAddButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Plus className="size-3 text-emerald-600" aria-hidden="true" />
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
