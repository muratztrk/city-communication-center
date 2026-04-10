import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

type LanguageSwitcherVariant = 'dark' | 'light'

interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant
}

export function LanguageSwitcher({ variant = 'dark' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()

  return (
    <div
      className={cn(
        'inline-flex rounded-full p-1',
        variant === 'dark' ? 'bg-white/10 ring-1 ring-white/10' : 'bg-slate-200/80 ring-1 ring-slate-300/60',
      )}
      aria-label={t('shell.language')}
    >
      {(['tr', 'en'] as const).map(language => (
        <button
          key={language}
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition',
            variant === 'dark'
              ? i18n.language === language
                ? 'bg-white text-slate-900'
                : 'text-white/75 hover:text-white'
              : i18n.language === language
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900',
          )}
          onClick={() => setAppLanguage(language)}
        >
          {language}
        </button>
      ))}
    </div>
  )
}
