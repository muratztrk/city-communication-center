import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { CitizenConversationDepartmentReview } from '../../types/platform'
import { WhatsAppConversationModal } from '../WhatsAppConversationModal'

const POLL_INTERVAL_MS = 12_000

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return `+${digits}`
}

export function WhatsAppDepartmentReviewFab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeReview, setActiveReview] = useState<CitizenConversationDepartmentReview | null>(null)

  const canSeeReviews = useMemo(() => {
    const roles = [user?.role, ...(user?.additionalRoles ?? [])]
    return roles.includes('Manager') || roles.includes('Staff') || roles.includes('SystemAdmin')
  }, [user])

  const reviewsQuery = useQuery({
    queryKey: ['ccc', 'citizen-conversations', 'department-reviews', 'pending', user?.userId ?? 'anonymous'],
    queryFn: () => api.getPendingCitizenConversationDepartmentReviews(),
    enabled: canSeeReviews,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const reviews = reviewsQuery.data ?? []
  const latestReview = reviews[0] ?? null

  const openReview = useCallback(async (review: CitizenConversationDepartmentReview) => {
    setActiveReview(review)
    try {
      await api.acknowledgeCitizenConversationDepartmentReview(review.reviewId)
      queryClient.setQueryData<CitizenConversationDepartmentReview[]>(
        ['ccc', 'citizen-conversations', 'department-reviews', 'pending', user?.userId ?? 'anonymous'],
        prev => (prev ?? []).filter(item => item.reviewId !== review.reviewId),
      )
    } catch {
      // Modal still opens; a later poll will reconcile pending state.
    }
  }, [queryClient, user])

  if (!canSeeReviews || !latestReview) {
    return null
  }

  const citizenHandle = latestReview.citizenName
    ?? (latestReview.citizenPhone ? formatPhone(latestReview.citizenPhone) : latestReview.departmentName)

  return (
    <div className="ccc-floating-fab relative shrink-0">
      <button
        type="button"
        aria-label={t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
        title={t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
        onClick={() => void openReview(latestReview)}
        className="ccc-floating-fab-btn group relative flex max-w-[min(18rem,calc(100vw-6rem))] cursor-pointer items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-left text-white shadow-lg transition-shadow duration-300 hover:shadow-xl"
      >
        <img src="/icons/whatsapp-fab.png" alt="" className="ccc-floating-fab-icon size-6 shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold leading-snug">
          {t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
        </span>
        {reviews.length > 1 ? (
          <span className="whatsapp-fab-badge shrink-0">{reviews.length}</span>
        ) : null}
      </button>

      {activeReview ? (
        <WhatsAppConversationModal
          socialMessageId={activeReview.socialMessageId}
          citizenHandle={citizenHandle}
          citizenPhone={activeReview.citizenPhone}
          citizenName={activeReview.citizenName}
          allowManagerReply
          onClose={() => {
            setActiveReview(null)
            void reviewsQuery.refetch()
          }}
        />
      ) : null}
    </div>
  )
}
