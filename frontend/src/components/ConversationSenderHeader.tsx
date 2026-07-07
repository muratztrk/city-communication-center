interface ConversationSenderHeaderProps {
  label: string
  align?: 'start' | 'end'
  variant?: 'pill' | 'inline'
  tone?: 'inbound' | 'outbound'
}

export function ConversationSenderHeader({
  label,
  align = 'end',
  variant = 'pill',
  tone = 'outbound',
}: ConversationSenderHeaderProps) {
  // "Kurum İçi Mesaj · Birim · Kullanıcı" etiketi iki satır olur: ilk satır standart turuncu
  // başlık (card #1341), ikinci satır birim + kullanıcı bilgisi (card #1347).
  const internalMatch = label.match(/^Kurum İçi Mesaj\s*·\s*(.+)$/)

  const inlineLabelClass = tone === 'inbound' ? 'text-slate-700' : 'text-slate-900'

  if (variant === 'inline') {
    if (internalMatch) {
      return (
        <div className="mb-1.5 leading-snug">
          <p className="text-[13px] font-bold text-orange-400">Kurum İçi Mesaj</p>
          <p className={`mt-1 text-[13px] font-bold ${inlineLabelClass}`}>
            {internalMatch[1]}
          </p>
        </div>
      )
    }
    return (
      <p className={`mb-1.5 text-[13px] font-bold leading-snug ${inlineLabelClass}`}>
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
