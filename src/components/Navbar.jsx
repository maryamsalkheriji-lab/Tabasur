import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar({ theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className={styles.nav}>
      <div className={styles.identity}>
        <Link className={styles.brand} to="/tabsur" onClick={() => setMenuOpen(false)} aria-label="معسكر تَبصَّر">
          <span className={styles.brandMark}>
            <img src="/assets/tabsur-mark.png" alt="" loading="eager" />
          </span>
        </Link>
        <a className={styles.organizer} href="/tabsur#partners" onClick={() => setMenuOpen(false)} aria-label="أمانة منطقة المدينة المنورة — الجهة المالكة">
          <span className={styles.brandMark}>
            <img src="/assets/amana-organizer.png" alt="" loading="eager" />
          </span>
        </a>
        <Link className={styles.brandWord} to="/tabsur" onClick={() => setMenuOpen(false)}>
          <span className={styles.ar}>معسكر تَبصَّر</span>
          <span className={styles.en}>TABSUR · CITY MARKETING CAMP</span>
        </Link>
      </div>

      <div className={`${styles.navLinks} ${menuOpen ? styles.navOpen : ''}`}>
        <a href="/tabsur#about"    onClick={() => setMenuOpen(false)}>المعسكر</a>
        <a href="/tabsur#pillars"  onClick={() => setMenuOpen(false)}>المسارات</a>
        <a href="/tabsur#who"      onClick={() => setMenuOpen(false)}>الفئة المستهدفة</a>
        <a href="/tabsur#timeline" onClick={() => setMenuOpen(false)}>الأيام</a>
        <a href="/tabsur#partners" onClick={() => setMenuOpen(false)}>الجهات المسؤولة</a>
        <a href="/tabsur#sponsors" onClick={() => setMenuOpen(false)}>الرعاة</a>
      </div>

      <div className={styles.navRight}>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={onToggleTheme}
          aria-label="الوضع الداكن"
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        >
          <svg key={theme} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13.2A8.7 8.7 0 0 1 10.8 3.5a8.7 8.7 0 1 0 9.7 9.7Z" />}
          </svg>
        </button>
        <Link className={styles.navCta} to="/register" onClick={() => setMenuOpen(false)}>
          سجّل الآن
        </Link>
        <button
          className={styles.burger}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="القائمة"
        >
          <span className={menuOpen ? styles.burgerLineTop : ''} />
          <span className={menuOpen ? styles.burgerLineMid : ''} />
          <span className={menuOpen ? styles.burgerLineBot : ''} />
        </button>
      </div>
    </nav>
  )
}
