import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { arabicToAscii, countryName, detectInternational, flagOf, getCountry, searchCountries } from '../lib/phone'

const MENU_HEIGHT = 340

// حقل جوال دولي: زر لاختيار الدولة (مع بحث بالاسم أو الرمز) بجانب حقل الرقم.
// onChange يستقبل { country, number }. كتابة رقم يبدأ بـ + أو 00 تبدّل الدولة تلقائيًا.
const DEFAULT_LABELS = { chooseCountry: 'اختر رمز الدولة', search: 'ابحث عن الدولة أو الرمز', noResults: 'لا توجد نتائج', common: 'الأكثر استخدامًا', all: 'كل الدول', placeholder: 'رقم الجوال' }

export default function PhoneInput({ id, name = 'mobile', country, number, onChange, lang = 'ar', labels = DEFAULT_LABELS, disabled }) {
  const selected = getCountry(country)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [placement, setPlacement] = useState(null)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const buttonRef = useRef(null)
  const listId = useId()

  const results = useMemo(() => searchCountries(query, lang), [query, lang])
  const flat = useMemo(() => [...results.pinned, ...results.all], [results])

  // تحديد مكان القائمة أسفل الحقل، أو أعلاه إذا لم تكفِ المساحة.
  function place() {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom
    const openUp = below < MENU_HEIGHT && rect.top > below
    const maxHeight = Math.max(200, Math.min(MENU_HEIGHT, (openUp ? rect.top : below) - 16))
    setPlacement({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    place()
    setQuery('')
    setActive(0)
    const focusTimer = requestAnimationFrame(() => searchRef.current?.focus())
    function onDocumentPointer(event) {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    function onScroll(event) {
      if (menuRef.current?.contains(event.target)) return
      place()
    }
    function onKey(event) {
      if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDocumentPointer)
    document.addEventListener('touchstart', onDocumentPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      cancelAnimationFrame(focusTimer)
      document.removeEventListener('mousedown', onDocumentPointer)
      document.removeEventListener('touchstart', onDocumentPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open, flat])

  function choose(next) {
    onChange({ country: next.iso, number })
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleNumber(event) {
    const raw = arabicToAscii(event.target.value)
    const intl = detectInternational(raw, selected.iso)
    if (intl && !intl.pending) {
      onChange({ country: intl.country.iso, number: intl.national.slice(0, 15) })
      return
    }
    // أرقام فقط، مع السماح بـ + في البداية حتى يكتمل رمز الدولة
    const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 16)
    onChange({ country: selected.iso, number: cleaned })
  }

  function handleSearchKey(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(index => Math.min(index + 1, flat.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (flat[active]) choose(flat[active])
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const isSaudi = selected.iso === 'SA'
  const dir = lang === 'en' ? 'ltr' : 'rtl'

  function renderOption(item, index) {
    const isActive = index === active
    return (
      <li key={item.iso} role="option" aria-selected={item.iso === selected.iso}
        className={`tel-option ${isActive ? 'is-active' : ''}`} data-active={isActive || undefined}
        onMouseMove={() => { if (!isActive) setActive(index) }}
        onClick={() => choose(item)}>
        <span className="tel-flag" aria-hidden="true">{flagOf(item.iso)}</span>
        <span className="tel-name">{countryName(item, lang)}</span>
        <span className="tel-dial" dir="ltr">+{item.dial}</span>
      </li>
    )
  }

  return (
    <div className="tel-wrap" ref={rootRef}>
      <div className={`tel-group ${open ? 'is-open' : ''}`}>
        <button ref={buttonRef} type="button" className="tel-prefix tel-country" disabled={disabled}
          aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-label={`${labels.chooseCountry}: ${countryName(selected, lang)} +${selected.dial}`}
          onClick={() => setOpen(current => !current)}>
          <span className="tel-flag" aria-hidden="true">{flagOf(selected.iso)}</span>
          <span className="tel-dial" dir="ltr">+{selected.dial}</span>
          <svg className="tel-caret" width="10" height="10" viewBox="0 0 12 8" aria-hidden="true">
            <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <input id={id} name={name} type="tel" inputMode="tel" dir="ltr" autoComplete="tel-national"
          maxLength={16} disabled={disabled}
          placeholder={isSaudi ? '05XXXXXXXX' : labels.placeholder}
          value={number} onChange={handleNumber} />
      </div>

      {open && placement && createPortal(
        <div ref={menuRef} className="tel-menu" dir={dir}
          style={{ left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom }}>
          <input ref={searchRef} className="tel-search" type="search" autoComplete="off" spellCheck={false}
            placeholder={labels.search} aria-label={labels.search}
            value={query} onChange={event => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={handleSearchKey} />
          <ul className="tel-list" id={listId} role="listbox" ref={listRef} aria-label={labels.chooseCountry}
            style={{ maxHeight: placement.maxHeight - 54 }}>
            {flat.length === 0 && <li className="tel-empty">{labels.noResults}</li>}
            {results.pinned.length > 0 && <li className="tel-group-label" role="presentation">{labels.common}</li>}
            {results.pinned.map((item, index) => renderOption(item, index))}
            {results.pinned.length > 0 && results.all.length > 0 && <li className="tel-group-label" role="presentation">{labels.all}</li>}
            {results.all.map((item, index) => renderOption(item, results.pinned.length + index))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}
