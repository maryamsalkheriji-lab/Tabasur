import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import styles from './TabsurLayout.module.css'

export default function TabsurLayout({ children }) {
  const isRemote = useLocation().pathname.replace(/\/$/, '') === '/tabsur/remote'
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tabsur-theme') === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try { localStorage.setItem('tabsur-theme', next) } catch { /* Storage may be unavailable. */ }
  }

  return (
    <div className={styles.layout} data-theme={theme}>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <main>{children}</main>
      <Footer compact={isRemote} />
    </div>
  )
}
