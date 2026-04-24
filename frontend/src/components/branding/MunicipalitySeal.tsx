import { useState } from 'react'
import { cn } from '../../lib/cn'

interface MunicipalitySealProps {
  className?: string
  compact?: boolean
  alt?: string
  src?: string | null
}

const FALLBACK_LOGO_SRC = '/favicon.svg'

export function MunicipalitySeal({ className, compact = false, alt = 'Municipality logo', src }: MunicipalitySealProps) {
  const requestedSrc = src || FALLBACK_LOGO_SRC
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const currentSrc = failedSrc === requestedSrc ? FALLBACK_LOGO_SRC : requestedSrc

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden border border-white/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.22),rgba(255,255,255,0.08))] shadow-[0_18px_48px_rgba(15,23,42,0.2)]',
        compact ? 'h-16 w-16 rounded-[1.35rem]' : 'h-24 w-24 rounded-[2rem]',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.32),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_44%)]" />
      <div className="absolute inset-[10%] rounded-[1.2rem] bg-white/14" />
      <img
        alt={alt}
        className={cn(
          'absolute inset-0 m-auto object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.22)]',
          compact ? 'h-[62%] w-[62%]' : 'h-[68%] w-[68%]',
        )}
        src={currentSrc}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(requestedSrc)}
      />
    </div>
  )
}
