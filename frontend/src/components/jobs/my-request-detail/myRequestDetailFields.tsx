import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { ChannelIcon } from '../../ui/channel-icon'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { formatJobDestinationsWithAssignees, formatRequestApproverDisplay, shouldShowRequestApproverField } from '../../../utils/jobDetails'
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
      ...(shouldShowRequestApproverField(detail) ? [{
        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
        value: formatRequestApproverDisplay(detail) ?? '—',
      }] : []),
      {
        label: t('jobs.detail.targetDepartment', 'Talebin Gittiği Birim'),
        value: formatJobDestinationsWithAssignees(detail),
      },
      { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
    ]
  }

  return [
    {
      label: t('jobs.columns.requestNo', 'Talep No'),
      value: <RequestNumberWithTypeLabel job={detail} t={t} locale={locale} />,
    },
    { label: t('jobs.form.title', 'Talep Başlığı'), value: detail.title },
    {
      label: t('jobs.detail.requestLocationCreator', 'Talep Yeri / Oluşturan'),
      value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
    },
    ...(shouldShowRequestApproverField(detail) ? [{
      label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
      value: formatRequestApproverDisplay(detail) ?? '—',
    }] : []),
    {
      label: t('jobs.detail.targetDepartment', 'Talebin Gittiği Birim'),
      value: formatJobDestinationsWithAssignees(detail),
    },
    {
      label: t('jobs.form.isProject', 'Proje mi'),
      value: <JobProjectValue job={detail} t={t} />,
      highlight: detail.isProject,
    },
    { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
  ]
}
