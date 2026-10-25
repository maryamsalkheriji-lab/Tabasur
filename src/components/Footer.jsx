import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
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
                <span className={styles.ar}>معسكر تَبصَّر</span>
                <span className={styles.en}>TABSUR · INSIGHT</span>
              </span>
            </Link>
            <p className={styles.tagline}>نحكي قصة التحوّل كما عاشها الناس.</p>
            <p className={styles.desc}>معسكر إنتاجي مكثف يعيد تقديم المدينة المنورة بصريًا، بدمج تسويق المدن والذكاء الاصطناعي وصناعة المحتوى.</p>
          </div>
          <div className={styles.col}>
            <h5>اكتشف</h5>
            <ul>
              <li><a href="/tabsur#about">عن المعسكر</a></li>
              <li><a href="/tabsur#pillars">مسارات التحدّي</a></li>
              <li><a href="/tabsur#timeline">المسار</a></li>
              <li><a href="/tabsur#outputs">المخرجات</a></li>
              <li><Link to="/register">التسجيل</Link></li>
            </ul>
          </div>
          <div className={styles.col}>
            <h5>تواصل</h5>
            <ul>
              <li><a href="mailto:info@cubex.com.sa">info@cubex.com.sa</a></li>
              <li><span>‎@tabsur.camp</span></li>
              <li><span>المدينة المنورة · KSA</span></li>
            </ul>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© 2026 تَبصَّر · جميع الحقوق محفوظة · <Link to="/admin" rel="nofollow">لوحة الإدارة</Link></span>
        </div>
      </div>
    </footer>
  )
}
