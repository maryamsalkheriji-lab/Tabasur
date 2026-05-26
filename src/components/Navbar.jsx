import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className={styles.nav}>
      <Link className={styles.brand} to="/" onClick={() => setMenuOpen(false)}>
        <span className={styles.brandMark}>
          <img src="/assets/tabsur-mark.png" alt="" loading="eager" />
        </span>
        <span className={styles.brandWord}>
          <span className={styles.ar}>معسكر المحتوى الإبداعي</span>
          <span className={styles.en}>TABSUR · CREATIVE CONTENT CAMP</span>
        </span>
      </Link>

      <div className={`${styles.navLinks} ${menuOpen ? styles.navOpen : ''}`}>
        <a href="/#about"    onClick={() => setMenuOpen(false)}>المعسكر</a>
        <a href="/#pillars"  onClick={() => setMenuOpen(false)}>المحاور</a>
        <a href="/#who"      onClick={() => setMenuOpen(false)}>لمن</a>
        <a href="/#timeline" onClick={() => setMenuOpen(false)}>الأيام</a>
        <a href="/#partners" onClick={() => setMenuOpen(false)}>الشركاء</a>
      </div>

      <div className={styles.navRight}>
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
