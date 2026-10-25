import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, hash, key } = useLocation()

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    let target
    try { target = hash && document.getElementById(decodeURIComponent(hash.slice(1))) }
    catch { /* An invalid fragment should still open the start of the page. */ }

    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' })
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, key])

  return null
}
