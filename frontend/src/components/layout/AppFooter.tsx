import { useTenantTheme } from '../../context/ThemeContext'

const FALLBACK_LOGO = '/favicon.svg'

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

function InstitutionLogo({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="Kurum logosu"
      className="h-7 w-auto max-w-[48px] object-contain"
      style={{ filter: 'brightness(0) invert(1)', opacity: 0.5 }}
      onError={e => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO }}
    />
  )
}

export function AppFooter() {
  const { appearance } = useTenantTheme()
  const year = new Date().getFullYear()
  const logoSrc = appearance?.logoUrl?.trim() || FALLBACK_LOGO

  return (
    <footer
      className="w-full shrink-0 select-none"
      style={{ background: 'var(--color-sidebar)' }}
    >
      <div className="grid grid-cols-3 items-center px-6 py-2">
        <div><LumespecLogo /></div>
        <div className="flex justify-center">
          <InstitutionLogo src={logoSrc} />
        </div>
        <div className="text-right text-[10.5px] font-medium tracking-wide text-white/30">
          © Her Hakkı Saklıdır – {year}
        </div>
      </div>
      <div className="h-[3px] w-full bg-[color:var(--color-primary)]" />
    </footer>
  )
}
