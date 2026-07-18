import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { DETAIL_ICON_PROPS } from './detailIcons'

interface MyRequestSectionHeadingProps {
  icon?: LucideIcon
  children: ReactNode
  tone?: 'primary' | 'muted' | 'card'
  className?: string
}

export function MyRequestSectionHeading({ icon: Icon, children, tone = 'card', className }: MyRequestSectionHeadingProps) {
  const titleClass = tone === 'primary'
    ? 'job-detail-section-title'
    : tone === 'muted'
      ? 'job-detail-section-title job-detail-section-title--muted'
      : 'job-detail-card-title'

  // Düz metin başlık (ör. Süreç) ikon kutusu yüksekliğinde ortalanır; aksi halde
  // satır kutusu ikonun optik merkezinin üstünde kalır (card #1665 reopen).
  const label = tone === 'card' && (typeof children === 'string' || typeof children === 'number')
    ? <span className="job-detail-card-title__label">{children}</span>
    : children

  return (
    <div className="job-detail-section-heading">
      <div className={[titleClass, className].filter(Boolean).join(' ')}>
        {Icon ? <Icon {...DETAIL_ICON_PROPS} /> : null}
        {label}
      </div>
    </div>
  )
}
