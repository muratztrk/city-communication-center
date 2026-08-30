import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { ChannelIcon } from '../../ui/channel-icon'
import type { JobDetail, SocialMessage } from '../../../types/platform'
import { formatJobDestinationsWithAssignees } from '../../../utils/jobDetails'
import { JobProjectValue } from '../../../utils/jobProjectDisplay'
import { shouldShowJobProjectField, isInternalProjectJob } from '../../../utils/jobProjectLabel'
import {
  formatCitizenPhoneDisplay,
  formatCitizenRequestNumber,
  isCitizenRequestJob,
  hasCitizenAddress,
} from '../../../utils/citizenRequests'
import { getPriorityLabel, getSocialChannelLabel } from '../../../utils/localization'
import { RequestNumberWithTypeLabel } from '../../../utils/requestDisplay'
import { StackedFieldValue, StackedFieldLabel } from './StackedFieldValue'
import { CitizenAddressPeekButton } from './CitizenAddressPeekButton'
import { displayMapsLink } from '../../../utils/coordinates'

export interface MyRequestDetailField {
  label: ReactNode
  value: ReactNode
  highlight?: boolean
  rowClass?: string
}

function destinationFieldLabel(
  detail: JobDetail,
  t: TFunction,
  options?: { includeAssignee?: boolean; splitLayout?: boolean },
): ReactNode {
  if (isInternalProjectJob(detail)) {
    return t('jobs.detail.projectOwner', 'Proje Sahibi')
  }
  if (options?.splitLayout) {
    return t('jobs.detail.targetDepartment', 'Talep Yapılan Birim')
  }
  const includeAssignee = options?.includeAssignee !== false
  if (includeAssignee && detail.requestType !== 'ExternalUnit') {
    return (
      <StackedFieldLabel
        top={t('jobs.detail.targetDepartment', 'Talep Yapılan Birim')}
        bottom={t('jobs.detail.assignee', 'Görevi Yapan')}
      />
    )
  }
  return t('jobs.detail.targetDepartment', 'Talep Yapılan Birim')
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
  // Taleplerim'de hedef birim/görevi yapan ayrı alanlar olarak kalır. Konum/oluşturan bütün
  // tüketicilerde birim üstte, oluşturan altta gösterilir (cards #1460/#1592/#1593).
  useMyRequestsFieldLayout = false,
  // Operatör / CRM: Talep Etiketi satırı (card #1896).
  showCitizenRequestLabel = false,
): MyRequestDetailField[] {
  // Sadece Taleplerim'de "Talep Yapılan Birim / Görevi Yapan" iki ayrı başlığa bölünür; "Görevi
  // Yapan" satırı yalnızca talebin görevi oluşup bir personele atanmışsa gösterilir (card #1460).
  const assigneeNames = [...new Set(
    detail.tasks.map(task => task.assignedUserDisplayName).filter((name): name is string => Boolean(name)),
  )]
  const isExternal = detail.requestType === 'ExternalUnit'
  // Dış birimde yeşil çerçeve kaldırıldı — eski StackedFieldValue / düz metin (card #r455).
  const locationCreatorValue = (
    <StackedFieldValue top={detail.ownerDepartmentName} bottom={detail.createdByDisplayName} />
  )
  const destinationDeptText = formatJobDestinationsWithAssignees(detail, false, false)
  const destinationValue = includeAssignee && !useMyRequestsFieldLayout
    ? (
      <StackedFieldValue
        top={destinationDeptText}
        bottom={assigneeNames.length > 0 ? assigneeNames.join(', ') : undefined}
      />
    )
    : destinationDeptText
  const locationLabel = isCitizenRequestJob(detail)
    ? t('jobs.detail.requestRouter', 'Talebi Yönlendiren')
    : (
      <StackedFieldLabel
        top={t('jobs.detail.requestLocation', 'Talep Yeri')}
        bottom={t('tasks.columns.createdBy', 'Oluşturan')}
      />
    )

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
        label: (
          <>
            <span className="hidden md:inline">{t('jobs.detail.citizenNamePhone', 'Vatandaş Adı / Telefon No')}</span>
            <StackedFieldLabel
              className="md:hidden"
              top={t('social.citizenName', 'Vatandaş Adı')}
              bottom={t('jobs.detail.citizenPhone', 'Telefon No')}
            />
          </>
        ),
        value: <StackedFieldValue top={detail.citizenName} bottom={formatCitizenPhoneDisplay(detail.citizenPhone)} />,
        rowClass: 'job-detail-field-row--citizen-contact',
      },
      ...(hasCitizenAddress(detail)
        ? [{
            label: t('jobs.detail.citizenAddressInfo', 'Vatandaş Adres Bilgisi'),
            value: (
              <CitizenAddressPeekButton
                neighborhood={detail.neighborhood}
                street={detail.street}
                streetNo={detail.streetNo}
                openAddress={detail.openAddress}
                coordinates={displayMapsLink(detail.locationMapsUrl, detail.latitude, detail.longitude)}
              />
            ),
          }]
        : []),
      { label: t('jobs.form.title', 'Talep Başlığı'), value: detail.title },
      {
        label: locationLabel,
        value: locationCreatorValue,
        rowClass: 'job-detail-field-row--location-creator',
      },
      ...(useMyRequestsFieldLayout
        ? [
            { label: destinationFieldLabel(detail, t, { splitLayout: true }), value: destinationValue },
            ...(!isExternal && assigneeNames.length > 0
              ? [{ label: t('jobs.detail.assignee', 'Görevi Yapan'), value: assigneeNames.join(', ') }]
              : []),
          ]
        : [{
            label: destinationFieldLabel(detail, t, { includeAssignee }),
            value: destinationValue,
          }]),
      { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
      ...(showCitizenRequestLabel
        ? [{ label: t('social.label', 'Talep Etiketi'), value: citizenSourceMessage?.category?.trim() || '—' }]
        : []),
      ...extraFields,
    ]
  }

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
    {
      label: locationLabel,
      value: locationCreatorValue,
      rowClass: 'job-detail-field-row--location-creator',
    },
    ...(useMyRequestsFieldLayout
      ? [
          { label: destinationFieldLabel(detail, t, { splitLayout: true }), value: destinationValue },
          ...(!isExternal && assigneeNames.length > 0 && !shouldShowJobProjectField(detail)
            ? [{ label: t('jobs.detail.assignee', 'Görevi Yapan'), value: assigneeNames.join(', ') }]
            : []),
        ]
      : [{
          label: destinationFieldLabel(detail, t, { includeAssignee }),
          value: destinationValue,
        }]),
    ...(shouldShowJobProjectField(detail)
      ? [{
          label: t('jobs.form.isProject', 'Proje mi'),
          value: <JobProjectValue job={detail} t={t} />,
          highlight: detail.isProject,
        }]
      : []),
    { label: t('jobs.columns.priority', 'Öncelik'), value: getPriorityLabel(t, detail.priority) },
    ...extraFields,
  ]
}
