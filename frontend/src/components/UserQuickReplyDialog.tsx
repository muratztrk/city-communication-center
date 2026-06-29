import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { UserQuickReplyTemplate } from '../types/platform'
import { TemplateDropdownList } from './WhatsAppTemplatePicker'
import { Button } from './ui/button'
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

  const handleSelectTemplate = (template: UserQuickReplyTemplate) => {
    setSelectedId(template.templateId)
    setEditingId(template.templateId)
    setName(template.name)
    setContent(template.content)
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

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              {t('whatsapp.userQuickReplyList', 'Kayıtlı şablonlar')}
            </p>
            {loading ? (
              <p className="text-sm text-slate-500">{t('common.loading', 'Yükleniyor…')}</p>
            ) : (
              <TemplateDropdownList
                items={templates}
                selectedId={selectedId}
                onSelect={handleSelectTemplate}
                emptyLabel={t('whatsapp.noUserQuickReplies', 'Henüz kişisel şablon yok.')}
              />
            )}
            {selectedId ? (
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const selected = templates.find(item => item.templateId === selectedId)
                    if (selected) handleSelectTemplate(selected)
                  }}
                >
                  <Pencil className="size-3.5" />
                  {t('common.edit', 'Düzenle')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-3.5" />
                  {t('common.delete', 'Sil')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  )
}

interface UserQuickReplyAddButtonProps {
  onChanged?: () => void
}

export function UserQuickReplyAddButton({ onChanged }: UserQuickReplyAddButtonProps) {
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
        onChanged={onChanged}
      />
    </>
  )
}
