import { useLanguage } from '../lib/language'
import styles from './LanguageToggle.module.css'

export default function LanguageToggle({ className = '' }) {
  const { lang, t, toggle } = useLanguage()
  const target = lang === 'ar' ? 'en' : 'ar'
  return (
    <button type="button" className={`${styles.toggle} ${className}`} onClick={toggle} aria-label={t.toggle.aria} title={t.toggle.aria} lang={target} data-lang={target}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <span>{t.toggle.short}</span>
    </button>
  )
}
