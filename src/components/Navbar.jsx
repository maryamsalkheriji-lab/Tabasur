import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { sponsors } from '../lib/camp'
import { useLanguage } from '../lib/language'
import LanguageToggle from './LanguageToggle'
import styles from './Navbar.module.css'

export default function Navbar({ theme, onToggleTheme }) {
  const { t } = useLanguage()
  const nav = t.nav
  const currentPath = useLocation().pathname.replace(/\/$/, '')
  const isRemote = currentPath === '/tabsur/remote'
  const isSubmit = currentPath === '/tabsur/submit'
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef(null)
  const toggleRef = useRef(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = e => {
      if (e.type === 'keydown' && e.key === 'Escape') { setMenuOpen(false); toggleRef.current?.focus() }
      if (e.type === 'pointerdown' && !navRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) }
  }, [menuOpen])

  return (
    <nav ref={navRef} className={styles.nav} aria-label={nav.aria}>
      <div className={styles.identity}>
        <Link className={styles.brand} to="/tabsur" onClick={() => setMenuOpen(false)} aria-label={nav.brandAria}>
          <span className={styles.brandMark}>
            <img src="/assets/tabsur-mark.png" alt="" loading="eager" />
          </span>
        </Link>
        <a className={styles.organizer} href="/tabsur#partners" onClick={() => setMenuOpen(false)} aria-label={nav.organizerAria}>
          <span className={styles.brandMark}>
            <img src="/assets/amana-organizer.png" alt="" loading="eager" />
          </span>
        </a>
        <Link className={styles.brandWord} to="/tabsur" onClick={() => setMenuOpen(false)}>
          <span className={styles.ar}>{nav.brandBig}</span>
          <span className={styles.en}>{nav.brandSmall}</span>
        </Link>
      </div>

      <div id="tabsur-navigation" className={`${styles.navLinks} ${menuOpen ? styles.navOpen : ''}`}>
        <a href="/tabsur#about"    onClick={() => setMenuOpen(false)}>{nav.camp}</a>
        <a href="/tabsur#pillars"  onClick={() => setMenuOpen(false)}>{nav.tracks}</a>
        <Link to="/tabsur/remote" className={styles.remoteLink} aria-current={isRemote ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{nav.remote} <span>{nav.remoteBadge}</span></Link>
        <Link to="/tabsur/submit" className={styles.remoteLink} aria-current={isSubmit ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{nav.submit} <span>{nav.submitBadge}</span></Link>
        <a href="/tabsur#who"      onClick={() => setMenuOpen(false)}>{nav.who}</a>
        <a href="/tabsur#timeline" onClick={() => setMenuOpen(false)}>{nav.days}</a>
        <a href="/tabsur#partners" onClick={() => setMenuOpen(false)}>{nav.partners}</a>
        <a href="/tabsur#sponsors" onClick={() => setMenuOpen(false)}>{sponsors.length ? nav.sponsors : nav.sponsorRegister}</a>
      </div>

      <div className={styles.navRight}>
        <LanguageToggle />
        <button
          type="button"
          className={styles.themeToggle}
          onClick={onToggleTheme}
          aria-label={nav.themeAria}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? nav.themeToLight : nav.themeToDark}
        >
          <svg key={theme} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13.2A8.7 8.7 0 0 1 10.8 3.5a8.7 8.7 0 1 0 9.7 9.7Z" />}
          </svg>
        </button>
        <Link className={styles.navCta} to="/register" onClick={() => setMenuOpen(false)}>{nav.register}</Link>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="tabsur-navigation"
          className={styles.burger}
          onClick={() => setMenuOpen(o => !o)}
          aria-label={nav.menu}
        >
          <span className={menuOpen ? styles.burgerLineTop : ''} />
          <span className={menuOpen ? styles.burgerLineMid : ''} />
          <span className={menuOpen ? styles.burgerLineBot : ''} />
        </button>
      </div>
    </nav>
  )
}
