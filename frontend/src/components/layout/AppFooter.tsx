/** Katman ikonu + wordmark lockup (#6a65ac32); footer'larda ortak, hafif büyütülmüş ölçü. */
function LumespecLogo() {
  return (
    <img
      src="/lumespec-logo.png"
      alt="Lumespec"
      className="h-9 w-auto select-none sm:h-10"
      draggable={false}
    />
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
