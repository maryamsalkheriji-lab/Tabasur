import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseActive } from '../../lib/supabase'
import { JudgeNav, Page, Spinner, EmptyState, ErrorBox, Badge, Icon } from '../components/ui'
import { eventStatus, jdError } from '../lib'

const A = '/assets/cubex/'

export default function Landing() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    if (!isSupabaseActive) { setError('إعدادات Supabase غير مكتملة.'); setLoading(false); return }
    const { data, error: err } = await supabase.from('jd_events').select('*').order('created_at', { ascending: false })
    if (err) setError(jdError(err)); else setEvents(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <Page nav={<JudgeNav cta={{ to: '/judge/admin', label: 'لوحة الأدمن', icon: 'settings' }} />}>
      <section className="jd-hero">
        <div className="jd-hero-glow" aria-hidden="true" />
        <div className="jd-hero-grid" aria-hidden="true" />
        <div className="jd-hero-inner jd-hero-grid2">
          <div>
            <span className="jd-pill jd-rise"><span className="dot" />منصة التحكيم</span>
            <p className="jd-kicker jd-rise" style={{ marginTop: 22 }}>JUDGING PLATFORM</p>
            <h1 className="jd-title jd-rise-2">تحكيم من الجوال،<br /><span>ونتائج تُكشف على المسرح</span></h1>
            <p className="jd-lead jd-rise-3">المحكّم يدخل برمز واحد، يرى المشاريع، ويقيّم كل مشروع على معايير المعسكر باختيار مستوى موصوف من 1 إلى 5. الدرجات تُحسب في قاعدة البيانات، والفائزون يُكشفون مركزًا مركزًا على شاشة الحفل.</p>
            <div className="jd-row jd-rise-3" style={{ marginTop: 24 }}>
              <a href="#events" className="jd-btn jd-btn-primary jd-btn-lg"><Icon name="star" size={18} />دخول المحكّمين</a>
              <Link to="/judge/admin" className="jd-btn jd-btn-ghost jd-btn-lg"><Icon name="settings" size={18} />لوحة الأدمن</Link>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 'clamp(160px,24vw,320px)' }} aria-hidden="true">
            <div style={{ position: 'absolute', width: '70%', aspectRatio: 1, borderRadius: '50%', background: 'radial-gradient(circle,rgba(150,76,255,.42) 0%,rgba(150,76,255,0) 68%)', animation: 'jdGlow 6s ease-in-out infinite' }} />
            <img src={A + 'cube-wire.png'} alt="" style={{ position: 'relative', width: 'min(70%,300px)', filter: 'drop-shadow(0 0 40px rgba(150,76,255,.55))', animation: 'jdFloat 11s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      <section id="events" className="jd-section-tight" style={{ paddingBottom: 'clamp(40px,6vw,84px)' }}>
        <div className="jd-sec-head">
          <div>
            <h2 className="jd-h2">الفعاليات</h2>
            <p className="jd-sub">محكّم؟ افتح فعاليتك وأدخل رمزك. جمهور؟ تابع النتائج بعد إعلانها.</p>
          </div>
        </div>
        {loading && <Spinner label="جارٍ تحميل الفعاليات…" />}
        {!loading && error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
        {!loading && !error && events.length === 0 && (
          <EmptyState icon="flag" title="لا توجد فعاليات بعد" text="أنشئ أول فعالية من لوحة الأدمن لتظهر هنا." action={<Link className="jd-btn jd-btn-primary" to="/judge/admin">لوحة الأدمن</Link>} />
        )}
        {!loading && !error && events.length > 0 && (
          <div className="jd-grid">
            {events.map((ev, i) => {
              const st = eventStatus(ev)
              return (
                <article key={ev.id} className={`jd-card ${i === 0 ? 'jd-card-featured' : ''}`} style={{ animation: `jdRise .7s cubic-bezier(.22,.7,.2,1) ${i * 0.08}s both` }}>
                  <div className="jd-row jd-row-between">
                    <Badge cls={st.cls} dot={st.live}>{st.label}</Badge>
                    <span className="jd-card-tag jd-mono">/judge/{ev.slug}</span>
                  </div>
                  <h3>{ev.name}</h3>
                  {ev.description && <p>{ev.description}</p>}
                  <div className="jd-card-foot">
                    <div className="jd-row">
                      <Link className="jd-btn jd-btn-primary jd-btn-sm" to={`/judge/${ev.slug}`}><Icon name="star" size={15} />دخول المحكّمين</Link>
                      {ev.results_published && <Link className="jd-btn jd-btn-ghost jd-btn-sm" to={`/judge/${ev.slug}/results`}><Icon name="trophy" size={15} />النتائج</Link>}
                    </div>
                    <span>{ev.winners_count || 3} مراكز</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </Page>
  )
}
