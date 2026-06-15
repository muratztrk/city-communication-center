import { useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { DateTimePicker } from './ui/date-time-picker'
import { MultiSelectDropdown } from './ui/multi-select-dropdown'
import { RichTextEditor } from './ui/RichTextEditor'
import { ConversationPanel } from './ConversationPanel'
import type { Department, SocialMessage } from '../types/platform'

interface CitizenRequestModalProps {
  message: SocialMessage
  departments: Department[]
  onClose: () => void
  onCreated: () => void
}

function toApiDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function hasRichTextContent(value: string): boolean {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
    .length > 0
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Vatandaş talebini "Birim Dışı Talep Oluştur" formuyla, ilgili WhatsApp konuşması yan tarafta
 * görünür şekilde bir pop-up içinde oluşturur (card 443).
 */
export function CitizenRequestModal({ message, departments, onClose, onCreated }: CitizenRequestModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const ownerDepartmentId = getActiveDepartmentId() ?? user?.departmentId ?? message.assignedDepartmentId ?? ''

  const [title, setTitle] = useState(message.category?.trim() || `@${message.citizenHandle}`)
  const [description, setDescription] = useState(message.content ? `<p>${escapeHtml(message.content)}</p>` : '')
  const [targetDepartmentId, setTargetDepartmentId] = useState('')
  const [isCoordinated, setIsCoordinated] = useState(false)
  const [coordinatedDepartmentIds, setCoordinatedDepartmentIds] = useState<string[]>([])
  const [priority, setPriority] = useState('Normal')
  const [isProject, setIsProject] = useState(false)
  const [startDateUtc, setStartDateUtc] = useState('')
  const [dueDateUtc, setDueDateUtc] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [street, setStreet] = useState('')
  const [openAddress, setOpenAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetDepartmentOptions = useMemo(
    () => departments.filter(department => department.departmentId !== ownerDepartmentId),
    [departments, ownerDepartmentId],
  )
  const coordinatedDepartmentOptions = useMemo(
    () => departments
      .filter(department => department.departmentId !== ownerDepartmentId && department.departmentId !== targetDepartmentId)
      .map(department => ({ value: department.departmentId, label: department.name })),
    [departments, ownerDepartmentId, targetDepartmentId],
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ownerDepartmentId) {
      setError(t('social.ownerDepartmentRequired', 'Önce bir müdürlük seçin.'))
      return
    }
    if (!targetDepartmentId) {
      setError(t('requests.create.targetDepartmentRequired', 'Talebin gideceği birim seçilmelidir.'))
      return
    }
    if (!hasRichTextContent(description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.convertSocialMessageToJob(message.socialMessageId, {
        title: title.trim() || `@${message.citizenHandle}`,
        description: description.trim(),
        ownerDepartmentId,
        priority,
        requestType: 'ExternalUnit',
        targetDepartmentIds: [targetDepartmentId, ...(isCoordinated ? coordinatedDepartmentIds : [])],
        isProject,
        startDateUtc: toApiDateTime(startDateUtc),
        dueDateUtc: toApiDateTime(dueDateUtc),
        neighborhood: neighborhood || null,
        street: street || null,
        openAddress: openAddress || null,
      })
      onCreated()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('common.error'))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[90dvh] max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary,var(--color-primary))] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/70">
              {t('social.title', 'Vatandaş Talepleri')}
            </div>
            <h2 className="text-base font-extrabold text-white">
              {t('requests.create.externalTitle', 'Birim Dışı')} — {t('nav.createRequest', 'Talep Oluştur')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label={t('common.close', 'Kapat')}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body: conversation (left) + external request form (right) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          {/* İlgili WhatsApp konuşması */}
          <div className="min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <ConversationPanel
              socialMessageId={message.socialMessageId}
              citizenHandle={message.citizenHandle}
              onClose={onClose}
              onReplySent={() => { /* talep oluşturma akışını etkilemez */ }}
            />
          </div>

          {/* Birim Dışı Talep Oluştur formu */}
          <form className="flex min-h-0 flex-col overflow-y-auto p-5" onSubmit={handleSubmit}>
            <div className="grid gap-3">
              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-req-title">
                  {t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="citizen-req-title"
                  className="field-input"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  required
                />
              </div>

              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-req-target">
                  {t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="citizen-req-target"
                  className="field-select"
                  value={targetDepartmentId}
                  onChange={event => setTargetDepartmentId(event.target.value)}
                >
                  <option value="">{t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}</option>
                  {targetDepartmentOptions.map(department => (
                    <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                  ))}
                </select>
              </div>

              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-req-coordinated">
                  {t('jobs.form.isCoordinated', 'Koordineli talep mi?')}
                </label>
                <select
                  id="citizen-req-coordinated"
                  className="field-select"
                  value={isCoordinated ? 'yes' : 'no'}
                  onChange={event => {
                    const next = event.target.value === 'yes'
                    setIsCoordinated(next)
                    if (!next) setCoordinatedDepartmentIds([])
                  }}
                >
                  <option value="no">{t('common.no', 'Hayır')}</option>
                  <option value="yes">{t('common.yes', 'Evet')}</option>
                </select>
              </div>

              {isCoordinated ? (
                <div className="job-field">
                  <span className="job-field-label">{t('jobs.form.coordinatedDepartments', 'Koordine Departmanlar')}</span>
                  <MultiSelectDropdown
                    options={coordinatedDepartmentOptions}
                    value={coordinatedDepartmentIds}
                    onChange={setCoordinatedDepartmentIds}
                    placeholder={t('requests.create.coordinatedDepartmentsPlaceholder', 'Koordine Departman seçin')}
                    emptyText={t('requests.create.coordinatedDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                  />
                  <span className="helper-copy">{t('jobs.form.coordinatedDepartmentsHelp', 'Koordineli olarak dahil edilecek ek departmanlar.')}</span>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-priority">{t('jobs.form.priority', 'Öncelik')}</label>
                  <select id="citizen-req-priority" className="field-select" value={priority} onChange={event => setPriority(event.target.value)}>
                    <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                    <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                    <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                  </select>
                </div>
                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-project">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</label>
                  <select id="citizen-req-project" className="field-select" value={isProject ? 'yes' : 'no'} onChange={event => setIsProject(event.target.value === 'yes')}>
                    <option value="no">{t('common.no', 'Hayır')}</option>
                    <option value="yes">{t('common.yes', 'Evet')}</option>
                  </select>
                </div>
                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-start">{t('jobs.form.startDate', 'Başlangıç Tarihi (Opsiyonel)')}</label>
                  <DateTimePicker id="citizen-req-start" value={startDateUtc} onChange={setStartDateUtc} />
                </div>
                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-due">{t('jobs.form.dueDate', 'Son Tarih (Opsiyonel)')}</label>
                  <DateTimePicker id="citizen-req-due" value={dueDateUtc} onChange={setDueDateUtc} />
                </div>
              </div>

              <div className="job-field">
                <span className="job-field-label">{t('address.sectionTitle', 'Adres Bilgisi (İsteğe Bağlı)')}</span>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="field-input"
                    placeholder={t('address.neighborhoodLabel', 'Mahalle')}
                    value={neighborhood}
                    onChange={event => setNeighborhood(event.target.value)}
                  />
                  <input
                    className="field-input"
                    placeholder={t('address.streetLabel', 'Cadde / Sokak / Bulvar')}
                    value={street}
                    onChange={event => setStreet(event.target.value)}
                  />
                </div>
                <input
                  className="field-input mt-2"
                  placeholder={t('address.openAddressLabel', 'Açık Adres')}
                  value={openAddress}
                  onChange={event => setOpenAddress(event.target.value)}
                />
              </div>

              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.description', 'Açıklama')} <span className="text-red-500">*</span></span>
                <RichTextEditor value={description} onChange={setDescription} required minHeight="min-h-40" />
              </div>

              {error ? <div className="error">{error}</div> : null}

              <Button type="submit" disabled={saving} className="gap-2">
                <Send className="size-4" />
                {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
