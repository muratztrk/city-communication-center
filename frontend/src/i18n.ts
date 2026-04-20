import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import tr from './locales/tr/common.json'
import en from './locales/en/common.json'

const LANGUAGE_STORAGE_KEY = 'ccc_language'

function getInitialLanguage(): 'tr' | 'en' {
  if (typeof window === 'undefined') {
    return 'tr'
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (storedLanguage === 'tr' || storedLanguage === 'en') {
    return storedLanguage
  }

  return 'tr'
}

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'tr',
  supportedLngs: ['tr', 'en'],
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', language => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export function setAppLanguage(language: 'tr' | 'en'): void {
  void i18n.changeLanguage(language)
}

export default i18n
