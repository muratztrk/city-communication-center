import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../api/client'
import { invalidateJobs } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { DateCell } from '../components/ui/date-cell'
import type { Department, EDevletBasvuruSummary, JobSummary } from '../types/platform'
import { getLocale } from '../utils/localization'

type ConvertForm = {
  title: string
  description: string
  ownerDepartmentId: string
  targetDepartmentId: string
  priority: string
}

const EMPTY_FORM: ConvertForm = {
  title: '',
  description: '',
  ownerDepartmentId: '',
  targetDepartmentId: '',
  priority: 'Normal',
}

export function EDevletBasvurularPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<EDevletBasvuruSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<EDevletBasvuruSummary | null>(null)
  const [form, setForm] = useState<ConvertForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const pageSize = 20

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [basvurular, deptList] = await Promise.all([
          api.getEDevletBasvurular('PendingReview'),
          api.getDepartments(),
        ])
        if (!cancelled) {
          setRows(basvurular)
          setDepartments(deptList)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('errors.generic', 'Bir hata oluştu.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [t])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      row.takipNo.toLowerCase().includes(q)
      || row.description.toLowerCase().includes(q)
      || `${row.citizenFirstName} ${row.citizenLastName}`.toLowerCase().includes(q))
  }, [rows, search])

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function openConvert(row: EDevletBasvuruSummary) {
    setSelected(row)
    setForm({
      title: `${row.basvuruTipi} - ${row.takipNo}`,
      description: row.description,
      ownerDepartmentId: departments[0]?.departmentId ?? '',
      targetDepartmentId: '',
      priority: 'Normal',
    })
  }

  async function submitConvert() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const job: JobSummary = await api.convertEDevletBasvuruToJob(selected.basvuruId, {
        title: form.title.trim(),
        description: form.description.trim(),
        ownerDepartmentId: form.ownerDepartmentId,
        priority: form.priority,
        targetDepartmentIds: form.targetDepartmentId ? [form.targetDepartmentId] : [],
      })
      setRows(current => current.filter(row => row.basvuruId !== selected.basvuruId))
      setSelected(null)
      setForm(EMPTY_FORM)
      invalidateJobs(queryClient)
      void job
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic', 'Bir hata oluştu.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--color-foreground)]">
          {t('nav.edevletBasvurular', 'e-Devlet Talep/Öneri Başvuruları')}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          {t('edevletBasvurular.subtitle', 'e-Devlet kapısından gelen başvurular operatör onayından sonra iş akışına alınır.')}
        </p>
      </div>

      <div className="surface-panel rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4 shadow-[var(--shadow-soft)]">
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
          <input
            value={search}
            onChange={event => { setSearch(event.target.value); setPage(1) }}
            placeholder={t('common.search', 'Ara...')}
            className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color:var(--color-background)] py-2 pl-10 pr-3 text-sm"
          />
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[color:var(--color-muted-foreground)]">
                <th className="px-3 py-2">{t('edevletBasvurular.trackingNo', 'Takip No')}</th>
                <th className="px-3 py-2">{t('edevletBasvurular.citizen', 'Başvuran')}</th>
                <th className="px-3 py-2">{t('edevletBasvurular.type', 'Tip')}</th>
                <th className="px-3 py-2">{t('edevletBasvurular.summary', 'Özet')}</th>
                <th className="px-3 py-2">{t('common.date', 'Tarih')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableEmptyStateRows columnCount={6} message={t('common.loading', 'Yükleniyor...')} />
              ) : pageRows.length === 0 ? (
                <TableEmptyStateRows columnCount={6} message={t('edevletBasvurular.empty', 'Onay bekleyen e-Devlet başvurusu yok.')} />
              ) : pageRows.map(row => (
                <tr key={row.basvuruId} className="border-b border-[var(--color-border)]/70">
                  <td className="px-3 py-3 font-medium">{row.takipNo}</td>
                  <td className="px-3 py-3">{row.citizenFirstName} {row.citizenLastName}</td>
                  <td className="px-3 py-3">{row.basvuruTipi}</td>
                  <td className="max-w-md truncate px-3 py-3">{row.description}</td>
                  <td className="px-3 py-3"><DateCell value={row.createdAtUtc} locale={locale} /></td>
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" onClick={() => openConvert(row)}>
                      {t('edevletBasvurular.convert', 'Talebe Dönüştür')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          totalCount={filtered.length}
          pageSize={pageSize}
          currentPage={page}
          onPageSizeChange={() => {}}
          onPageChange={setPage}
        />
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-background)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t('edevletBasvurular.convertTitle', 'e-Devlet Başvurusunu Talebe Dönüştür')}</h2>
            <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">{selected.takipNo}</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.title', 'Başlık')}</span>
                <input className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.description', 'Açıklama')}</span>
                <textarea className="min-h-28 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.ownerDepartment', 'Sahip Müdürlük')}</span>
                <select className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.ownerDepartmentId} onChange={e => setForm({ ...form, ownerDepartmentId: e.target.value })}>
                  {departments.map(dept => (
                    <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.targetDepartment', 'Hedef Birim')}</span>
                <select className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.targetDepartmentId} onChange={e => setForm({ ...form, targetDepartmentId: e.target.value })}>
                  <option value="">{t('common.optional', 'Opsiyonel')}</option>
                  {departments.filter(dept => dept.departmentId !== form.ownerDepartmentId).map(dept => (
                    <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)} disabled={submitting}>{t('common.cancel', 'İptal')}</Button>
              <Button onClick={() => void submitConvert()} disabled={submitting || !form.title.trim() || !form.description.trim() || !form.ownerDepartmentId}>
                {submitting ? t('common.saving', 'Kaydediliyor...') : t('edevletBasvurular.convertConfirm', 'Talep Oluştur')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
