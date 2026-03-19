import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './tr.json';
import en from './en.json';

const savedLang = document.cookie.match(/lang=(\w+)/)?.[1] || 'tr';

i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export default i18n;

export function setLanguage(lang: string) {
  if (lang !== 'tr' && lang !== 'en') lang = 'tr';
  i18n.changeLanguage(lang);
  document.cookie = `lang=${lang};max-age=${60 * 60 * 24 * 365};path=/`;
  document.documentElement.lang = lang;
}
