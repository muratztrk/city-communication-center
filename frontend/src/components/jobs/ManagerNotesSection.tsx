import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import type { ConfirmDialogState } from '../ui/confirm-dialog'
import type { JobManagerNote } from '../../types/platform'

interface ManagerNotesSectionProps {
  notes?: JobManagerNote[] | null
  /** managerNotes boşken (eski kayıt) gösterilecek birleşik metin. */
  legacyText?: string | null
  currentUserId?: string | null
  /** Not ekleyebilir/değiştirebilir (talep aktif ve kullanıcı yönetici). */
  canEdit: boolean
  draft: string
  editing: boolean
  saved: boolean
  saving: boolean
  onDraftChange: (value: string) => void
  onEditStart: () => void
  onEditCancel: () => void
  onSave: () => void
  onDeleteConfirm: () => void
  setConfirmDialog: (state: ConfirmDialogState | null) => void
}

function formatNoteDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Yönetici Notu kartının içeriği: yazar + tarih satırı, altında not; her yönetici yalnız kendi notunu değiştirir/siler. */
export function ManagerNotesSection({
  notes,
  legacyText,
  currentUserId,
  canEdit,
  draft,
  editing,
  saved,
  saving,
  onDraftChange,
  onEditStart,
  onEditCancel,
  onSave,
  onDeleteConfirm,
  setConfirmDialog,
}: ManagerNotesSectionProps) {
  const { t } = useTranslation()
  const list = notes ?? []
  const ownNote = currentUserId ? list.find(note => note.authorUserId === currentUserId) : undefined
  const showAddForm = canEdit && !ownNote
  const showEditForm = canEdit && Boolean(ownNote) && editing

  const confirmDelete = () => setConfirmDialog({
    title: t('jobs.managerNote.deleteTitle', 'Notu Sil'),
    titleDivider: true,
    message: 'Notu silmek istediğinize emin misiniz?',
    variant: 'destructive',
    confirmLabel: t('common.delete', 'Sil'),
    cancelLabel: t('common.cancel', 'İptal'),
    onConfirm: onDeleteConfirm,
  })

  const textarea = (
    <textarea
      className="field-textarea manager-note-textarea min-h-24 w-full text-[0.8125rem] placeholder:text-xs"
      rows={3}
      maxLength={100}
      value={draft}
      onChange={e => onDraftChange(e.target.value)}
      placeholder={t('jobs.managerNote.placeholder', 'Yönetici notu girin...')}
    />
  )

  const renderNote = (note: JobManagerNote) => {
    const isOwn = note.authorUserId === currentUserId
    if (isOwn && showEditForm) return null
    return (
      <div key={note.noteId} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold text-slate-500">
          {note.authorDisplayName?.trim() || t('jobs.managerNote.unknownAuthor', 'Yönetici')}
          {' · '}
          {formatNoteDate(note.updatedAtUtc ?? note.createdAtUtc)}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{note.text}</p>
        {isOwn && canEdit ? (
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="success"
              size="sm"
              disabled={saving}
              onClick={onEditStart}
            >
              {t('common.change', 'Değiştir')}
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={confirmDelete}>
              {t('common.delete', 'Sil')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {list.length === 0 && legacyText?.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-slate-800">{legacyText}</p>
      ) : null}
      {list.length === 0 && !legacyText?.trim() && !showAddForm ? (
        <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
      ) : null}
      {list.map(renderNote)}
      {showEditForm ? (
        <div>
          {textarea}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="success" size="sm" disabled={saving || !draft.trim()} onClick={onSave}>
              {t('common.save', 'Kaydet')}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onEditCancel}>
              {t('common.cancel', 'İptal')}
            </Button>
          </div>
        </div>
      ) : null}
      {showAddForm ? (
        <div>
          {saved ? (
            <p className="mb-3 text-sm font-semibold text-emerald-600">{t('jobs.managerNote.saved', 'Notunuz Eklendi')}</p>
          ) : null}
          {textarea}
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="success" size="sm" className="disabled:opacity-100" disabled={saving || !draft.trim()} onClick={onSave}>
              {t('jobs.managerNote.add', 'Not Ekle')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const noop = () => undefined

/** Salt-okunur Yönetici Notu listesi (yazar + tarih + not). */
export function ManagerNotesReadOnly({ notes, legacyText }: { notes?: JobManagerNote[] | null; legacyText?: string | null }) {
  return (
    <ManagerNotesSection
      notes={notes}
      legacyText={legacyText}
      canEdit={false}
      draft=""
      editing={false}
      saved={false}
      saving={false}
      onDraftChange={noop}
      onEditStart={noop}
      onEditCancel={noop}
      onSave={noop}
      onDeleteConfirm={noop}
      setConfirmDialog={noop}
    />
  )
}
