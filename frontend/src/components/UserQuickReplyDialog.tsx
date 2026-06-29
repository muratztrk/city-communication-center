import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { UserQuickReplyTemplate } from '../types/platform'
import { Button } from './ui/button'
import { ModalBackdrop } from './ui/modal-backdrop'

interface UserQuickReplyDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (content: string) => void
}

export function UserQuickReplyDialog({ open, onClose, onSelect }: UserQuickReplyDialogProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<UserQuickReplyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')

  const resetForm = () => {
    setEditingId(null)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (template: UserQuickReplyTemplate) => {
    setEditingId(template.templateId)
    setName(template.name)
    setContent(template.content)
  }

  const handleDelete = async (templateId: string) => {
    setSaving(true)
    setError(null)
    try {
      await api.deleteUserQuickReply(templateId)
      if (editingId === templateId) resetForm()
      await loadTemplates()
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
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Kapat')}
            className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
            <div className="flex justify-end gap-2">
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-slate-500">{t('common.loading', 'Yükleniyor…')}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-slate-500">{t('whatsapp.noUserQuickReplies', 'Henüz kişisel şablon yok.')}</p>
          ) : (
            <ul className="space-y-2">
              {templates.map(template => (
                <li
                  key={template.templateId}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        onSelect(template.content)
                        onClose()
                      }}
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{template.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.content}</p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={t('common.edit', 'Düzenle')}
                        onClick={() => handleEdit(template)}
                        className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('common.delete', 'Sil')}
                        onClick={() => void handleDelete(template.templateId)}
                        className="flex size-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  )
}

interface UserQuickReplyAddButtonProps {
  onSelect: (content: string) => void
}

export function UserQuickReplyAddButton({ onSelect }: UserQuickReplyAddButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {t('whatsapp.addUserTemplate', 'Şablon mesaj ekle')}
      </button>
      <UserQuickReplyDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
      />
    </>
  )
}
