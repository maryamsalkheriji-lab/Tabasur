import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminSession, translateAuthError } from '../../lib/adminAuth'
import { JudgeNav, Page, Spinner, Alert, Field, Badge, ErrorBox, Icon, useToast } from '../components/ui'
import { eventStatus, jdError } from '../lib'
import Events from './Events'
import Projects from './Projects'
import Judges from './Judges'
import Control from './Control'
import LiveResults from './LiveResults'
import Remote from './Remote'

const TABS = [
  { key: 'events',   label: 'الفعاليات', icon: 'flag' },
  { key: 'projects', label: 'المشاريع', icon: 'layers' },
  { key: 'judges',   label: 'المحكّمون', icon: 'users' },
  { key: 'control',  label: 'التحكم', icon: 'settings' },
  { key: 'live',     label: 'النتائج الحية', icon: 'chart' },
  { key: 'remote',   label: 'جهاز الكشف', icon: 'monitor' },
]
const EVENT_KEY = 'jd_admin_event'
const TAB_KEY = 'jd_admin_tab'

export default function AdminApp() {
  const auth = useAdminSession({ recoveryPath: '/judge/admin' })
  const nav = <JudgeNav links={auth.status === 'signed_in' ? [{ label: 'خروج', onClick: auth.signOut }] : []} />

  if (auth.status === 'loading') return <Page nav={nav} mid><section className="jd-section"><Spinner label="جارٍ التحقق من الجلسة…" /></section></Page>
  if (auth.status === 'unavailable') return <Page nav={nav} narrow><section className="jd-section"><Alert kind="error">إعدادات Supabase غير مكتملة — أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.</Alert></section></Page>
  if (auth.status === 'recovery') return <Page nav={nav} narrow><SetPassword auth={auth} /></Page>
  if (auth.status !== 'signed_in') return <Page nav={nav} narrow><AdminLogin auth={auth} /></Page>
  return <AdminPanel auth={auth} nav={nav} />
}

/* ─── الدخول (نفس Supabase Auth المستخدم في لوحة تبصر) ─── */
function AdminLogin({ auth }) {
  const [email, setEmail] = useState(auth.adminEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (!email.trim()) { setError('اكتب البريد الإلكتروني'); return }
    if (!password) { setError('اكتب كلمة المرور'); return }
    setBusy(true); setError(''); setInfo('')
    try { await auth.signIn(email, password); setPassword('') }
    catch (err) { setError(translateAuthError(err)) }
    finally { setBusy(false) }
  }
  async function forgot() {
    if (busy) return
    if (!email.trim()) { setError('اكتب بريدك أولًا ثم اضغط «نسيت كلمة المرور»'); return }
    setBusy(true); setError(''); setInfo('')
    try { await auth.resetPassword(email); setInfo('إذا كان البريد مسجّلًا كأدمن فستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة. افتح الرابط من نفس المتصفح.') }
    catch (err) { setError(translateAuthError(err)) }
    finally { setBusy(false) }
  }
  return (
    <section className="jd-section">
      <form className="jd-panel jd-rise jd-stack" onSubmit={submit} style={{ gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <span className="jd-state-icon" style={{ margin: '0 auto 12px' }}><Icon name="shield" size={24} /></span>
          <p className="jd-kicker">ADMIN ACCESS</p>
          <h1 className="jd-h2" style={{ marginTop: 6 }}>لوحة أدمن التحكيم</h1>
          <p className="jd-sub">نفس حساب أدمن تَبصَّر (Supabase Auth): البريد وكلمة المرور.</p>
        </div>
        <Field label="البريد الإلكتروني">
          <input className="jd-input" type="email" dir="ltr" value={email} onChange={e => { setEmail(e.target.value); setError('') }} autoComplete="username" placeholder="admin@example.com" />
        </Field>
        <Field label="كلمة المرور">
          <input className="jd-input" type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} autoComplete="current-password" placeholder="••••••••" autoFocus />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        {info && <Alert kind="ok">{info}</Alert>}
        <button type="submit" className="jd-btn jd-btn-primary jd-btn-lg jd-btn-block" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
        <button type="button" className="jd-link" onClick={forgot} disabled={busy} style={{ alignSelf: 'center' }}>نسيت كلمة المرور؟</button>
        <div className="jd-help">
          <Icon name="info" size={18} />
          <div>الحساب يُنشأ من لوحة Supabase: Authentication ← Users ← Add user، ثم يُضاف معرّفه في جدول <span className="jd-mono">jd_admins</span>. نفس الجلسة تفتح <Link to="/admin" className="jd-link">لوحة أدمن تَبصَّر</Link>.</div>
        </div>
      </form>
    </section>
  )
}

function SetPassword({ auth }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (p1.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (p1 !== p2) { setError('كلمتا المرور غير متطابقتين'); return }
    setBusy(true); setError('')
    try { await auth.updatePassword(p1) }
    catch (err) { setError(translateAuthError(err)) }
    finally { setBusy(false) }
  }
  return (
    <section className="jd-section">
      <form className="jd-panel jd-rise jd-stack" onSubmit={submit} style={{ gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <p className="jd-kicker">RESET PASSWORD</p>
          <h1 className="jd-h2" style={{ marginTop: 6 }}>تعيين كلمة مرور جديدة</h1>
          {auth.user?.email && <p className="jd-sub jd-mono">{auth.user.email}</p>}
        </div>
        <Field label="كلمة المرور الجديدة"><input className="jd-input" type="password" value={p1} onChange={e => setP1(e.target.value)} autoComplete="new-password" autoFocus /></Field>
        <Field label="تأكيد كلمة المرور"><input className="jd-input" type="password" value={p2} onChange={e => setP2(e.target.value)} autoComplete="new-password" /></Field>
        {error && <Alert kind="error">{error}</Alert>}
        <button type="submit" className="jd-btn jd-btn-primary jd-btn-lg jd-btn-block" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ والدخول'}</button>
        <button type="button" className="jd-link" onClick={auth.signOut} style={{ alignSelf: 'center' }}>إلغاء</button>
      </form>
    </section>
  )
}

/* ─── اللوحة ─── */
function AdminPanel({ auth, nav }) {
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(null)
  const [eventId, setEventId] = useState(() => { try { return localStorage.getItem(EVENT_KEY) || '' } catch { return '' } })
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem(TAB_KEY); return TABS.some(x => x.key === t) ? t : 'events' } catch { return 'events' } })

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError('') }
    const { data, error: err } = await supabase.from('jd_events').select('*').order('created_at', { ascending: false })
    if (err) { if (!silent) setError(jdError(err)); else toast.err(jdError(err)) }
    else setEvents(data || [])
    if (!silent) setLoading(false)
  }, [toast])

  useEffect(() => { loadEvents() }, [loadEvents])

  // هل الحساب في جدول jd_admins؟ (RLS تُرجع الصف فقط للأدمن)
  useEffect(() => {
    if (!auth.user?.id) return
    let active = true
    supabase.from('jd_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle().then(({ data, error: err }) => {
      if (!active) return
      setIsAdmin(err ? null : Boolean(data))
    })
    return () => { active = false }
  }, [auth.user?.id])

  useEffect(() => {
    if (!events.length) return
    if (!events.some(e => e.id === eventId)) setEventId(events[0].id)
  }, [events, eventId])
  useEffect(() => { try { localStorage.setItem(EVENT_KEY, eventId || '') } catch { /* ignore */ } }, [eventId])
  useEffect(() => { try { localStorage.setItem(TAB_KEY, tab) } catch { /* ignore */ } }, [tab])

  const event = useMemo(() => events.find(e => e.id === eventId) || null, [events, eventId])

  // متابعة تغيّرات الفعاليات مباشرة (الريموت من جهاز آخر مثلًا)
  useEffect(() => {
    const channel = supabase.channel('jd_events_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jd_events' }, (payload) => {
        if (payload.eventType === 'DELETE') setEvents(list => list.filter(e => e.id !== payload.old?.id))
        else setEvents(list => {
          const idx = list.findIndex(e => e.id === payload.new.id)
          if (idx === -1) return [payload.new, ...list]
          const next = list.slice(); next[idx] = { ...list[idx], ...payload.new }; return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const patchEvent = useCallback((id, patch) => setEvents(list => list.map(e => (e.id === id ? { ...e, ...patch } : e))), [])
  const ctx = { supabase, event, events, reloadEvents: loadEvents, patchEvent, setEventId, setTab, toast, user: auth.user }

  return (
    <Page nav={nav}>
      <div className="jd-admin-head jd-rise">
        <div>
          <p className="jd-kicker">JUDGING ADMIN</p>
          <h1 className="jd-h2" style={{ marginTop: 4 }}>لوحة أدمن التحكيم</h1>
          <p className="jd-sub jd-mono" style={{ fontSize: 12 }}>{auth.user?.email}</p>
        </div>
        <div className="jd-event-select">
          <label className="jd-small jd-muted" htmlFor="jd-event-select">الفعالية النشطة</label>
          <select id="jd-event-select" className="jd-select" value={eventId} onChange={e => setEventId(e.target.value)} disabled={!events.length}>
            {events.length === 0 && <option value="">لا توجد فعاليات</option>}
            {events.map(e => <option key={e.id} value={e.id}>{e.name} · {e.slug}</option>)}
          </select>
          {event && (() => { const st = eventStatus(event); return <Badge cls={st.cls} dot={st.live}>{st.label}</Badge> })()}
        </div>
      </div>

      {isAdmin === false && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="warn" icon="shield">
            حسابك غير موجود في جدول <span className="jd-mono">jd_admins</span>، فستُرفض عمليات التعديل. أضف الصف التالي من Supabase (SQL Editor):
            <div className="jd-mono jd-small" style={{ marginTop: 6, direction: 'ltr', textAlign: 'left', userSelect: 'all' }}>insert into public.jd_admins (user_id) values ('{auth.user?.id}');</div>
          </Alert>
        </div>
      )}

      <div className="jd-tabs" role="tablist">
        {TABS.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className="jd-tab" onClick={() => setTab(t.key)}><Icon name={t.icon} size={15} />{t.label}</button>)}
      </div>

      <section style={{ padding: '18px 0 48px' }}>
        {loading && <Spinner label="جارٍ تحميل الفعاليات…" />}
        {!loading && error && <ErrorBox onRetry={() => loadEvents()}>{error}</ErrorBox>}
        {!loading && !error && (
          <>
            {tab === 'events' && <Events {...ctx} />}
            {tab !== 'events' && !event && <Alert kind="info">أنشئ فعالية أولًا من تبويب «الفعاليات».</Alert>}
            {tab === 'projects' && event && <Projects key={event.id} {...ctx} />}
            {tab === 'judges' && event && <Judges key={event.id} {...ctx} />}
            {tab === 'control' && event && <Control key={event.id} {...ctx} />}
            {tab === 'live' && event && <LiveResults key={event.id} {...ctx} />}
            {tab === 'remote' && event && <Remote key={event.id} {...ctx} />}
          </>
        )}
      </section>
    </Page>
  )
}
