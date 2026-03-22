import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '../../i18n'
import { cn } from '../../lib/cn'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/10" aria-label={t('shell.language')}>
      {(['tr', 'en'] as const).map(language => (
        <button
          key={language}
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition',
            i18n.language === language
              ? 'bg-white text-slate-900'
              : 'text-white/75 hover:text-white',
          )}
          onClick={() => setAppLanguage(language)}
        >
          {language}
        </button>
      ))}
    </div>
  )
}
