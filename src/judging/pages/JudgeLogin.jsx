import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseActive } from '../../lib/supabase'
import { judgeLogin, getJudgeSession, judgeSessionExpired, judgeLogout } from '../judgeClient'
import { JudgeNav, Page, Alert, Badge, Icon } from '../components/ui'
import { eventStatus, formatAccessCode, isValidAccessCode, judgeLoginError, jdError } from '../lib'

/* /judge/<slug> — دخول المحكّم برمز فقط */
export default function JudgeLogin() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(() => formatAccessCode(params.get('code') || ''))
  const [event, setEvent] = useState(null)
  const [eventError, setEventError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = getJudgeSession()
    if (s?.token && s.slug === slug && !judgeSessionExpired()) navigate(`/judge/${slug}/judge`, { replace: true })
    else if (s?.token && judgeSessionExpired()) judgeLogout()
  }, [slug, navigate])

  useEffect(() => {
    let active = true
    if (!isSupabaseActive) { setEventError('إعدادات Supabase غير مكتملة.'); return }
    supabase.from('jd_events').select('*').eq('slug', slug).maybeSingle().then(({ data, error: err }) => {
      if (!active) return
      if (err) setEventError(jdError(err))
      else if (!data) setEventError('الفعالية غير موجودة — تأكد من الرابط.')
      else setEvent(data)
    })
    return () => { active = false }
  }, [slug])

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const clean = formatAccessCode(code)
    if (!isValidAccessCode(clean)) { setError('اكتب الرمز كاملًا بصيغة XXXX-XXXX (8 خانات).'); return }
    setBusy(true); setError('')
    try {
      await judgeLogin(slug, clean)
      navigate(`/judge/${slug}/judge`, { replace: true })
    } catch (err) {
      setError(judgeLoginError(err?.message))
    } finally {
      setBusy(false)
    }
  }

  const st = event ? eventStatus(event) : null
  return (
    <Page nav={<JudgeNav />} narrow>
      <section className="jd-section">
        <div className="jd-panel jd-rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span className="jd-state-icon" style={{ margin: '0 auto 12px' }}><Icon name="star" size={24} /></span>
            <p className="jd-kicker">JUDGE ACCESS</p>
            <h1 className="jd-h2" style={{ marginTop: 6 }}>دخول المحكّمين</h1>
            {event && (
              <div className="jd-row" style={{ justifyContent: 'center', marginTop: 10 }}>
                <span className="jd-muted">{event.name}</span>
                <Badge cls={st.cls} dot={st.live}>{st.label}</Badge>
              </div>
            )}
          </div>
          {eventError && <Alert kind="error">{eventError}</Alert>}
          {event && !event.judging_open && <Alert kind="warn" icon="lock">التحكيم غير مفتوح الآن. يمكنك الدخول وسيُتاح التقييم عندما يفتحه المنظّمون.</Alert>}
          <form onSubmit={submit} className="jd-stack">
            <label htmlFor="judge-code" className="jd-small jd-muted" style={{ textAlign: 'center' }}>اكتب رمز الدخول الذي وصلك من المنظّمين</label>
            <input id="judge-code" className="jd-input jd-code-input" value={code} onChange={e => { setCode(formatAccessCode(e.target.value)); setError('') }} placeholder="XXXX-XXXX" inputMode="latin" autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} maxLength={9} disabled={busy || !!eventError} autoFocus />
            {error && <Alert kind="error">{error}</Alert>}
            <button type="submit" className="jd-btn jd-btn-primary jd-btn-lg jd-btn-block" disabled={busy || !!eventError}>{busy ? 'جارٍ التحقق…' : <><Icon name="unlock" size={18} />دخول</>}</button>
          </form>
          <p className="jd-small jd-dim" style={{ textAlign: 'center' }}>الرمز شخصي ويُنشئ جلسة صالحة 12 ساعة على هذا الجهاز. لا حاجة لبريد أو كلمة مرور.</p>
          <div className="jd-row" style={{ justifyContent: 'center' }}>
            <Link to="/judge" className="jd-link">الرئيسية</Link>
            {event?.results_published && <Link to={`/judge/${slug}/results`} className="jd-link">النتائج</Link>}
          </div>
        </div>
      </section>
    </Page>
  )
}
