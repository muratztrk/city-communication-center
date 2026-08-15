interface ConversationSenderHeaderProps {
  label: string
  align?: 'start' | 'end'
  variant?: 'pill' | 'inline'
  tone?: 'inbound' | 'outbound'
  /** Vatandaş Talebi Oluştur konuşmasında başlığı biraz küçült (#2634). */
  compact?: boolean
}

export function ConversationSenderHeader({
  label,
  align = 'end',
  variant = 'pill',
  tone = 'outbound',
  compact = false,
}: ConversationSenderHeaderProps) {
  const nameSize = compact ? 'text-[12px]' : 'text-[13px]'
  const phoneSize = compact ? 'text-[9px]' : 'text-[10px]'
  const phoneOnlySize = compact ? 'text-[10px]' : 'text-[11px]'
  // "Kurum İçi Mesaj · Birim · Kullanıcı" etiketi iki satır olur: ilk satır standart turuncu
  // başlık (card #1341), ikinci satır birim + kullanıcı bilgisi (card #1347).
  const internalMatch = label.match(/^Kurum İçi Mesaj\s*·\s*(.+)$/)
  const internalParts = internalMatch?.[1].split(/\s*·\s*/).filter(Boolean) ?? []
  const citizenWithPhoneMatch = tone === 'inbound'
    ? label.match(/^(.*?)\s+(\+\d[\d\s]+)$/)
    : null
  const citizenPhoneOnly = tone === 'inbound' && /^\+\d[\d\s]+$/.test(label)

  const inlineLabelClass = tone === 'inbound' ? 'text-slate-700 font-semibold' : 'text-white/90 font-semibold'

  if (variant === 'inline') {
    if (internalMatch) {
      return (
        <div className="mb-1.5 leading-snug">
          <p className={`${nameSize} font-semibold text-orange-400`}>Kurum İçi Mesaj</p>
          <p className={`mt-1 ${nameSize} ${inlineLabelClass}`}>
            {internalParts.length >= 2 ? (
              <>{internalParts.slice(0, -1).join(' · ')} · <span className="italic">{internalParts.at(-1)}</span></>
            ) : internalMatch[1]}
          </p>
        </div>
      )
    }
    if (citizenWithPhoneMatch) {
      return (
        <p className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 leading-snug">
          <span className={`${nameSize} font-semibold text-slate-700`}>{citizenWithPhoneMatch[1]}</span>
          <span className={`${phoneSize} font-medium text-slate-400`}>{citizenWithPhoneMatch[2]}</span>
        </p>
      )
    }
    if (citizenPhoneOnly) {
      return (
        <p className={`mb-1.5 ${phoneOnlySize} font-medium leading-snug text-slate-400`}>
          {label}
        </p>
      )
    }
    return (
      <p className={`mb-1.5 ${nameSize} leading-snug ${inlineLabelClass}`}>
        {label}
      </p>
    )
  }

  return (
    <div className={`mb-1 flex ${align === 'start' ? 'justify-start' : 'justify-end'}`}>
      <span
        className={`inline-flex max-w-[85%] items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          align === 'start'
            ? 'bg-white/90 text-slate-600 ring-1 ring-slate-200/80'
            : 'bg-[#007985]/15 text-[#007985] ring-1 ring-[#007985]/20'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
