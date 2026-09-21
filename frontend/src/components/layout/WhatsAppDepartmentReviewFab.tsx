import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { CitizenConversationDepartmentReview } from '../../types/platform'
import { formatBadgeCount } from '../../utils/formatScopeChipBadgeCount'
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
  const [isOpen, setIsOpen] = useState(false)

  const canSeeReviews = useMemo(() => {
    const roles = [user?.role, ...(user?.additionalRoles ?? [])]
    return roles.includes('Manager') || roles.includes('SystemAdmin')
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

  const openReview = useCallback(async (review: CitizenConversationDepartmentReview) => {
    setActiveReview(review)
    setIsOpen(false)
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

  if (!canSeeReviews || reviews.length === 0) {
    return null
  }

  const badgeLabel = formatBadgeCount(reviews.length)

  return (
    <div className="ccc-floating-fab relative size-12 shrink-0">
      {isOpen ? (
        <div className="whatsapp-notification-fab-panel absolute bottom-full z-20 mb-3 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[#25D366]/10 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--color-foreground)]">
                {t('whatsapp.departmentReviewPanelTitle', 'İnceleme Bekleyen Mesajlar')}
              </p>
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                {reviews.length > 0
                  ? t('whatsapp.departmentReviewPanelSubtitle', '{{count}} mesaj inceleme bekliyor', { count: reviews.length })
                  : t('whatsapp.departmentReviewPanelEmptyHint', 'Yeni inceleme talebi geldiğinde burada görünür.')}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-foreground)]"
              aria-label={t('common.close', 'Kapat')}
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {reviews.map(review => {
              const citizenHandle = review.citizenName
                ?? (review.citizenPhone ? formatPhone(review.citizenPhone) : review.departmentName)
              return (
                <button
                  key={review.reviewId}
                  type="button"
                  onClick={() => void openReview(review)}
                  className="flex w-full items-start gap-3 border-b border-[var(--color-border)]/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
                    <img src="/icons/whatsapp.webp" alt="" className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[color:var(--color-primary)] hover:underline">
                      {t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
                    </p>
                    <p className="mt-1 truncate text-xs text-[color:var(--color-muted-foreground)]">
                      {citizenHandle}
                    </p>
                    {review.departmentName ? (
                      <p className="truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                        {review.departmentName}
                      </p>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
        title={t('whatsapp.departmentReviewFabLabel', 'İncelenmesi Gereken Mesajı Oku')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
        className={`ccc-floating-fab-btn group relative flex size-12 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-shadow duration-300 hover:shadow-xl ${isOpen ? '' : 'transition-transform hover:scale-110 active:scale-95'}`}
      >
        <span className="absolute inset-0 rounded-full bg-[#25D366]/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
        <img src="/icons/whatsapp-fab.png" alt="" className="ccc-floating-fab-icon relative size-6" aria-hidden="true" />
        {reviews.length > 0 ? (
          <span className={`whatsapp-fab-badge pointer-events-none absolute -right-0.5 -top-0.5 ${badgeLabel.length > 1 ? 'whatsapp-fab-badge--wide' : ''}`}>
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {activeReview ? (
        <WhatsAppConversationModal
          socialMessageId={activeReview.socialMessageId}
          citizenHandle={activeReview.citizenName
            ?? (activeReview.citizenPhone ? formatPhone(activeReview.citizenPhone) : activeReview.departmentName)}
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
