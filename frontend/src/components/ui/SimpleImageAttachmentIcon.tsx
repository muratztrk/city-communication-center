import type { LucideProps } from 'lucide-react'

/**
 * Görsel ekler için sade çerçeve ikonu — belge/FileText ile net ayrışır,
 * Lucide Image'daki güneş+dağ detayı yoktur (card #1637 reopen).
 * Boyut sınıfları (size-3 / size-3.5) çağıran tarafta kalır.
 */
export function SimpleImageAttachmentIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
    </svg>
  )
}
