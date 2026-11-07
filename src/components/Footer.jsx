import { Link } from 'react-router-dom'
import { useLanguage } from '../lib/language'
import styles from './Footer.module.css'

export default function Footer({ compact = false }) {
  const { t } = useLanguage()
  const f = t.footer
  if (compact) return <footer className={styles.compact}><div className="container"><Link to="/tabsur">{f.brandBig}</Link><span>{f.rights}</span><a href="mailto:info@cubex.com.sa">{f.contact}</a></div></footer>
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div className={styles.brand}>
            <Link className={styles.brandLink} to="/tabsur">
              <span className={styles.brandMark}>
                <img src="/assets/tabsur-mark.png" alt="" />
              </span>
              <span className={styles.brandWord}>
                <span className={styles.ar}>{f.brandBig}</span>
                <span className={styles.en}>{f.brandSmall}</span>
              </span>
            </Link>
            <p className={styles.tagline}>{f.tagline}</p>
            <p className={styles.desc}>{f.desc}</p>
          </div>
          <div className={styles.col}>
            <h5>{f.discover}</h5>
            <ul>
              <li><a href="/tabsur#about">{f.about}</a></li>
              <li><a href="/tabsur#pillars">{f.tracks}</a></li>
              <li><Link to="/tabsur/remote">{f.remote}</Link></li>
              <li><a href="/tabsur#timeline">{f.timeline}</a></li>
              <li><a href="/tabsur#outputs">{f.outputs}</a></li>
              <li><Link to="/register">{f.register}</Link></li>
            </ul>
          </div>
          <div className={styles.col}>
            <h5>{f.contactTitle}</h5>
            <ul>
              <li><a href="mailto:info@cubex.com.sa">info@cubex.com.sa</a></li>
              <li><span>{f.location}</span></li>
            </ul>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>{f.rights} · <Link to="/admin" rel="nofollow">{f.admin}</Link></span>
        </div>
      </div>
    </footer>
  )
}
