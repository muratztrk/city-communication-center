import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { UserQuickReplyTemplate } from '../types/platform'
import { Button } from './ui/button'
import { SingleSelectDropdown } from './ui/single-select-dropdown'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ModalBackdrop } from './ui/modal-backdrop'
import { ModalCloseButton } from './ui/modal-close-button'

interface UserQuickReplyDialogProps {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export function UserQuickReplyDialog({ open, onClose, onChanged }: UserQuickReplyDialogProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<UserQuickReplyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const resetForm = () => {
    setEditingId(null)
    setSelectedId(null)
    setName('')
    setContent('')
  }

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await api.getUserQuickReplies())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    resetForm()
    void loadTemplates()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const trimmedName = name.trim()
    const trimmedContent = content.trim()
    if (!trimmedName || !trimmedContent) return

    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.updateUserQuickReply(editingId, { name: trimmedName, content: trimmedContent })
      } else {
        await api.createUserQuickReply({ name: trimmedName, content: trimmedContent })
      }
      resetForm()
      await loadTemplates()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setSaving(false)
    }
  }

  const handleSelectTemplate = (templateId: string) => {
    if (!templateId) {
      resetForm()
      return
    }
    const template = templates.find(item => item.templateId === templateId)
    if (!template) return
    setSelectedId(template.templateId)
    setEditingId(template.templateId)
    setName(template.name)
    setContent(template.content)
  }

  const handleDeleteConfirm = () => {
    if (!selectedId) return
    setConfirmDialog({
      title: t('whatsapp.userQuickReplyDeleteTitle', 'Şablonu Sil'),
      titleDivider: true,
      message: t('whatsapp.userQuickReplyDeleteConfirm', 'Bu şablon mesajı silmek istediğinize emin misiniz?'),
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
      await api.deleteUserQuickReply(selectedId)
      resetForm()
      await loadTemplates()
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
            {t('whatsapp.userQuickRepliesTitle', 'Kişisel şablon mesajlar')}
          </h2>
          <ModalCloseButton onClick={onClose} label={t('common.close', 'Kapat')} />
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">
              {editingId
                ? t('whatsapp.editUserQuickReply', 'Şablonu düzenle')
                : t('whatsapp.addUserQuickReply', 'Yeni şablon ekle')}
            </p>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={t('whatsapp.userQuickReplyName', 'Şablon adı')}
              className="field-input w-full text-sm"
            />
            <textarea
              rows={3}
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder={t('whatsapp.userQuickReplyContent', 'Mesaj metni')}
              className="field-input min-h-[4.5rem] w-full resize-y text-sm"
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                {t('whatsapp.userQuickReplyList', 'Kayıtlı şablonlar')}
              </label>
              <SingleSelectDropdown
                options={templates.map(template => ({
                  value: template.templateId,
                  label: template.name,
                }))}
                value={selectedId ?? ''}
                onChange={handleSelectTemplate}
                placeholder={
                  loading
                    ? t('common.loading', 'Yükleniyor…')
                    : templates.length === 0
                      ? t('whatsapp.noUserQuickReplies', 'Henüz kişisel şablon yok.')
                      : t('whatsapp.selectUserQuickReply', 'Şablon seçin…')
                }
                emptyText={t('whatsapp.noUserQuickReplies', 'Henüz kişisel şablon yok.')}
                disabled={loading}
                searchable={templates.length >= 7}
                searchPlaceholder={t('whatsapp.searchUserQuickReply', 'Şablon ara...')}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2">
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
              {editingId ? (
                <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
                  {t('common.cancel', 'İptal')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={saving || !name.trim() || !content.trim()}
                onClick={() => void handleSave()}
              >
                {editingId ? t('common.save', 'Kaydet') : t('common.add', 'Ekle')}
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

interface UserQuickReplyAddButtonProps {
  onChanged?: () => void
  compact?: boolean
}

export function UserQuickReplyAddButton({ onChanged, compact = false }: UserQuickReplyAddButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${compact ? 'h-7 px-2 text-[11px]' : 'h-9 px-2.5 text-xs'}`}
      >
        <Plus className="size-3 text-emerald-600" aria-hidden="true" />
        {t('whatsapp.addUserTemplate', 'Şablon mesaj ekle')}
      </button>
      <UserQuickReplyDialog
        open={open}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </>
  )
}
