import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <label className="language-switcher">
      <span>{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={i18n.resolvedLanguage ?? 'tr'}
        onChange={event => setAppLanguage(event.target.value as 'tr' | 'en')}
      >
        <option value="tr">{t('language.options.tr')}</option>
        <option value="en">{t('language.options.en')}</option>
      </select>
    </label>
  );
}
