import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { ChannelIcon } from '../../ui/channel-icon'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { formatJobDestinationsWithAssignees } from '../../../utils/jobDetails'
import { JobProjectValue } from '../../../utils/jobProjectDisplay'
import {
  formatCitizenPhoneDisplay,
  formatCitizenRequestNumber,
  isCitizenRequestJob,
} from '../../../utils/citizenRequests'
import { getPriorityLabel, getSocialChannelLabel } from '../../../utils/localization'
import { RequestNumberWithTypeLabel } from '../../../utils/requestDisplay'

export interface MyRequestDetailField {
  label: string
  value: ReactNode
  highlight?: boolean
}

export function buildMyRequestDetailFields(
  detail: JobDetail,
  t: TFunction,
  locale: string,
  citizenSourceMessage: SocialMessage | null | undefined,
  requestNumberSuffix?: ReactNode,
  extraFields: MyRequestDetailField[] = [],
  // Görevlerim popup'ında (İlgili Talep Detayları), atanan kişi bilgisi zaten Görev Bilgileri
  // panelinde gösterildiği için tekrar edilmez (card #1446).
  includeAssignee = true,
  // Yalnızca Taleplerim'de "Talep Yeri / Oluşturan" ve "Talep Yapılan Birim / Görevi Yapan"
  // birleşik başlıkları ayrı satırlara bölünür; Görevlerim/Dashboard gibi diğer tüketiciler
  // birleşik gösterimi korur (card #1460).
  splitLocationFields = false,
): MyRequestDetailField[] {
  if (isCitizenRequestJob(detail)) {
    return [
      {
        label: t('jobs.detail.citizenRequestNo', 'Vatandaş Talep No'),
        value: (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: detail.createdAtUtc }, locale)}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
              ({t('jobs.detail.citizenRequest', 'Vatandaş Talebi')}
              <ChannelIcon channel={citizenSourceMessage?.channel ?? 'WhatsApp'} className="size-3.5 shrink-0" />
              <span className="text-slate-900">{getSocialChannelLabel(t, citizenSourceMessage?.channel ?? 'WhatsApp')}</span>)
            </span>
          </span>
        ),
      },
      {
        label: t('jobs.detail.citizenNamePhone', 'Vatandaş Adı / Telefon No'),
        value: [detail.citizenName, formatCitizenPhoneDisplay(detail.citizenPhone)].filter(Boolean).join(' / ') || '—',
      },
      { label: t('jobs.form.title', 'Talep Başlığı'), value: detail.title },
      {
        label: t('jobs.detail.requestLocationCreator', 'Talep Yeri / Oluşturan'),
        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
      },
      {
        label: includeAssignee
          ? t('jobs.detail.targetDepartmentAssignee', 'Talep Yapılan Birim / Görevi Yapan')
          : t('jobs.detail.targetDepartment', 'Talep Yapılan Birim'),
        value: includeAssignee
          ? formatJobDestinationsWithAssignees(detail, true)
          : formatJobDestinationsWithAssignees(detail, false, false),
      },
      { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
      ...extraFields,
    ]
  }

  // Sadece Taleplerim'de "Talep Yapılan Birim / Görevi Yapan" iki ayrı başlığa bölünür; "Görevi
  // Yapan" satırı yalnızca talebin görevi oluşup bir personele atanmışsa gösterilir (card #1460).
  const assigneeNames = [...new Set(
    detail.tasks.map(task => task.assignedUserDisplayName).filter((name): name is string => Boolean(name)),
  )]

  return [
    {
      label: t('jobs.columns.requestNo', 'Talep No'),
      value: (
        <span className="inline-flex flex-wrap items-center gap-2">
          <RequestNumberWithTypeLabel job={detail} t={t} locale={locale} />
          {requestNumberSuffix}
        </span>
      ),
    },
    { label: t('jobs.form.title', 'Talep Başlığı'), value: detail.title },
    ...(splitLocationFields
      ? [
          { label: t('jobs.detail.requestLocation', 'Talep Yeri'), value: detail.ownerDepartmentName || '—' },
          { label: t('jobs.detail.requestCreator', 'Talebi Oluşturan'), value: detail.createdByDisplayName || '—' },
        ]
      : [{
          label: t('jobs.detail.requestLocationCreator', 'Talep Yeri / Oluşturan'),
          value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
        }]),
    ...(splitLocationFields
      ? [
          { label: t('jobs.detail.targetDepartment', 'Talep Yapılan Birim'), value: formatJobDestinationsWithAssignees(detail, false, false) },
          ...(assigneeNames.length > 0
            ? [{ label: t('jobs.detail.assignee', 'Görevi Yapan'), value: assigneeNames.join(', ') }]
            : []),
        ]
      : [{
          label: includeAssignee
            ? t('jobs.detail.targetDepartmentAssignee', 'Talep Yapılan Birim / Görevi Yapan')
            : t('jobs.detail.targetDepartment', 'Talep Yapılan Birim'),
          value: includeAssignee
            ? formatJobDestinationsWithAssignees(detail, true)
            : formatJobDestinationsWithAssignees(detail, false, false),
        }]),
    {
      label: t('jobs.form.isProject', 'Proje mi'),
      value: <JobProjectValue job={detail} t={t} />,
      highlight: detail.isProject,
    },
    { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
    ...extraFields,
  ]
}
