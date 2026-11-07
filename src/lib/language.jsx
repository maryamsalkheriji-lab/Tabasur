import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readStoredLanguage, saveLanguage, translations } from './i18n'

const LanguageContext = createContext({ lang: 'ar', dir: 'rtl', locale: 'ar-SA', t: translations.ar, setLang: () => {}, toggle: () => {} })

// Wraps the public Tabsur pages: keeps the chosen language in localStorage and mirrors it on <html>.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return readStoredLanguage(window.localStorage) } catch { return 'ar' }
  })
  const setLang = useCallback(next => {
    const value = next === 'en' ? 'en' : 'ar'
    setLangState(value)
    try { saveLanguage(window.localStorage, value) } catch { /* Storage may be unavailable. */ }
  }, [])
  const toggle = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang])
  const t = translations[lang]

  useEffect(() => {
    const html = document.documentElement
    const previous = { lang: html.lang, dir: html.dir }
    html.lang = t.code
    html.dir = t.dir
    return () => { html.lang = previous.lang; html.dir = previous.dir }
  }, [t])

  const value = useMemo(() => ({ lang, dir: t.dir, locale: t.locale, t, setLang, toggle }), [lang, t, setLang, toggle])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }
