import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import trCommon from './locales/tr/common.json';

void i18n
  .use(initReactI18next)
  .init({
    lng: 'tr',
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en'],
    interpolation: {
      escapeValue: false,
    },
    resources: {
      tr: {
        common: trCommon,
      },
      en: {
        common: enCommon,
      },
    },
    defaultNS: 'common',
  });

export default i18n;
