import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { STAGES, SCORE_VALUES, SCORE_LABELS } from '../lib'

const A = '/assets/cubex/'

/* ─── أيقونات خطية بسيطة (inline SVG) ─── */
const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.36M15 5.2a3 3 0 0 1 0 5.6',
  user: 'M18 20v-1.5A3.5 3.5 0 0 0 14.5 15h-5A3.5 3.5 0 0 0 6 18.5V20M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  play: 'M8 5l11 7-11 7V5z',
  copy: 'M9 9h10v11H9zM5 15V4h11',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  phone: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  note: 'M4 4h16v12l-4 4H4zM8 9h8M8 13h5',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7',
}
export function Icon({ name, size = 18, className = '', style }) {
  const d = ICONS[name]
  if (!d) return null
  return (
    <svg className={`jd-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={d} />
    </svg>
  )
}

/* ─── الشريط العلوي + الفوتر ─── */
export function JudgeNav({ links = [], cta = null, children }) {
  return (
    <nav className="jd-nav">
      <div className="jd-nav-inner">
        <Link to="/judge" className="jd-brand" aria-label="منصة التحكيم — كيوبكس">
          <img src={A + 'cube-wire.png'} alt="" />
          <span className="jd-brand-word">
            <b>Cube<span>X</span></b>
            <small>JUDGING · منصة التحكيم</small>
          </span>
        </Link>
        <div className="jd-nav-links">
          <NavLink to="/judge" end>الرئيسية</NavLink>
          <a href="/">موقع كيوبكس</a>
          {links.map(l => l.to
            ? <NavLink key={l.label} to={l.to} end={l.end}>{l.label}</NavLink>
            : <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}
          {children}
          {cta && <Link to={cta.to} className="jd-nav-cta">{cta.icon && <Icon name={cta.icon} size={16} />}{cta.label}</Link>}
        </div>
      </div>
    </nav>
  )
}

export function JudgeFooter() {
  return (
    <>
      <footer className="jd-footer">
        <span>© 2026 كيوبكس · منصة التحكيم</span>
        <span className="mono">FROM CHALLENGE TO VENTURE</span>
      </footer>
      <div className="jd-strip" aria-hidden="true"><span /><span /><span /></div>
    </>
  )
}

export function Page({ nav, children, narrow, mid }) {
  return (
    <div className="jd">
      {nav}
      <main className="jd-main">
        <div className={`jd-wrap ${narrow ? 'jd-wrap-narrow' : ''} ${mid ? 'jd-wrap-mid' : ''}`}>{children}</div>
      </main>
      <JudgeFooter />
    </div>
  )
}

/* ─── الحالات ─── */
export function Spinner({ label = 'جارٍ التحميل…', plain }) {
  return (
    <div className={`jd-state ${plain ? 'jd-state-plain' : ''}`} role="status" aria-live="polite">
      <div className="jd-spinner" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title, text, action, icon = 'layers' }) {
  return (
    <div className="jd-state">
      <span className="jd-state-icon" aria-hidden="true"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div className="jd-alert jd-alert-error" role="alert">
      <div className="jd-row jd-row-between">
        <span>{children}</span>
        {onRetry && <button type="button" className="jd-btn jd-btn-danger jd-btn-sm" onClick={onRetry}><Icon name="refresh" size={15} />إعادة المحاولة</button>}
      </div>
    </div>
  )
}

export function Alert({ kind = 'info', icon, children }) {
  return <div className={`jd-alert jd-alert-${kind}`}>{icon && <Icon name={icon} size={16} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />}{children}</div>
}

export function HelpBox({ title, children }) {
  return (
    <div className="jd-help">
      <Icon name="info" size={18} />
      <div>{title && <b>{title}</b>}<div>{children}</div></div>
    </div>
  )
}

export function StageBadge({ stage }) {
  const s = STAGES[stage] || { label: stage || '—', badge: 'jd-badge-gray' }
  return <span className={`jd-badge ${s.badge}`}>{s.label}</span>
}

export function Badge({ cls = 'jd-badge-gray', dot, icon, children }) {
  return <span className={`jd-badge ${cls}`}>{dot && <span className="dot" />}{icon && <Icon name={icon} size={13} />}{children}</span>
}

export function Progress({ done, total, label, showPercent = true }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="jd-progress" aria-label={label}>
      <div className="jd-progress-meta">
        <span>{label}</span>
        <span><b>{done}</b> من {total}{showPercent ? ` · ${pct}%` : ''}</span>
      </div>
      <div className="jd-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="jd-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* حلقة تقدّم دائرية */
export function Ring({ value = 0, size = 56, stroke = 6, label, tone = 'purple', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  return (
    <div className={`jd-ring jd-ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="fg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v)} strokeLinecap="round" />
      </svg>
      <span className="jd-ring-val">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="jd-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className="jd-seg-btn" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  )
}

export function StatCard({ icon, value, label, sub, tone }) {
  return (
    <div className={`jd-stat ${tone ? `jd-stat-${tone}` : ''}`}>
      <div className="jd-stat-top">{icon && <span className="jd-stat-ic"><Icon name={icon} size={16} /></span>}<b>{value}</b></div>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
}

/* ─── النافذة المنبثقة ─── */
export function Modal({ open, title, onClose, children, closeLabel = 'إغلاق', actions, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="jd-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="jd-modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: 'min(100%, 760px)' } : undefined}>
        {title && <h3>{title}</h3>}
        {children}
        {(actions || onClose) && (
          <div className="jd-modal-actions">
            {actions}
            {onClose && <button type="button" className="jd-btn jd-btn-ghost" onClick={onClose}>{closeLabel}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, text, confirmLabel = 'تأكيد', danger, onConfirm, onCancel, busy }) {
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onCancel} closeLabel="إلغاء"
      actions={<button type="button" className={`jd-btn ${danger ? 'jd-btn-danger' : 'jd-btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : confirmLabel}</button>}>
      <p className="jd-muted" style={{ lineHeight: 1.8 }}>{text}</p>
    </Modal>
  )
}

/* ─── التنبيهات العابرة (Toast) ─── */
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const idRef = useRef(0)
  const push = useCallback((text, kind = '') => {
    const id = ++idRef.current
    setItems(list => [...list, { id, text, kind }])
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 3200)
  }, [])
  const api = useMemo(() => ({ push, ok: (t) => push(t, 'ok'), err: (t) => push(t, 'err') }), [push])
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="jd-toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={`jd-toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
export function useToast() { return useContext(ToastCtx) }

/* ─── حقل مع عنوان ─── */
export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`jd-field ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="jd-toggle" onClick={() => onChange?.(!checked)} disabled={disabled} />
  )
}

/* ─── اختيار المستوى 1–5: بطاقات موصوفة (نجوم + عنوان المستوى + وصفه) تُختار بلمسة واحدة ─── */
const STAR_PATH = 'M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9L12 2.8z'
export function LevelPicker({ value, onChange, disabled, levels, label }) {
  return (
    <div className="jd-lvls" role="radiogroup" aria-label={label}>
      {SCORE_VALUES.map(v => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`jd-lvl ${value === v ? 'is-on' : ''}`} onClick={() => onChange?.(v)} disabled={disabled}>
          <span className="jd-lvl-stars" aria-hidden="true">{SCORE_VALUES.map(i => <svg key={i} className={i <= v ? 'on' : ''} viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>)}</span>
          <span className="jd-lvl-txt"><b>{v} · {SCORE_LABELS[v]}</b><small>{levels?.[v]}</small></span>
          <span className="jd-lvl-check"><Icon name="check" size={14} /></span>
        </button>
      ))}
    </div>
  )
}
