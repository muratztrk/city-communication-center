/** "gg.aa.yyyy • ss:dd": tarih ile saat arasında küçük dairesel bullet (#6ac24eb9 / #6ac20f3b). */
export function DateTimeText({ value, locale }: { value: string; locale: string }) {
  const date = new Date(value)
  return (
    <span>
      {date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
      <span aria-hidden="true" className="mx-1.5 inline-block size-[3.5px] rounded-full bg-current align-middle opacity-70" />
      {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}
