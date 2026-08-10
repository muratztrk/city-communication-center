import type { ButtonHTMLAttributes } from 'react'
import { formatScopeChipBadgeCount } from '../../utils/formatScopeChipBadgeCount'

type ScopeChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  badgeCount?: number
}

/** Banner scope chip; optional overdue count badge (zil ikonu rozeti ile aynı stil — card #2525). */
export function ScopeChipButton({ badgeCount = 0, className = '', children, ...props }: ScopeChipButtonProps) {
  const badgeLabel = formatScopeChipBadgeCount(badgeCount)
  const showBadge = badgeCount > 0

  return (
    <button type="button" className={`scope-chip-with-badge ${className}`.trim()} {...props}>
      {children}
      {showBadge ? (
        <span
          className={`scope-chip-overdue-badge${badgeLabel.length > 1 ? ' scope-chip-overdue-badge--wide' : ''}`}
          aria-label={badgeLabel}
        >
          {badgeLabel}
        </span>
      ) : null}
    </button>
  )
}
