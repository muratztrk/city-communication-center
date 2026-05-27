function LumespecLogo() {
  return (
    <div className="flex items-center gap-1.5 text-white/30">
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.8" />
        <rect x="10" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="1" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="10" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.8" />
      </svg>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]">Lumespec</span>
    </div>
  )
}


export function AppFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="w-full shrink-0 select-none"
      style={{ background: 'var(--color-sidebar)' }}
    >
      <div className="flex items-center justify-between px-6 py-1">
        <LumespecLogo />
        <div className="text-[10.5px] font-medium tracking-wide text-white/30">
          © Her Hakkı Saklıdır – {year}
        </div>
      </div>
      <div className="h-[3px] w-full bg-[color:var(--color-primary)]" />
    </footer>
  )
}
