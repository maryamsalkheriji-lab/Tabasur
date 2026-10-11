import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import confetti from 'canvas-confetti'
import { supabase, isSupabaseActive } from '../../lib/supabase'
import { JudgeNav, Page, Spinner, ErrorBox, EmptyState, StageBadge, Badge, Icon, useToast } from '../components/ui'
import { RANK_META, REVEAL_STEPS, eventStatus, fmtScore, jdError, prefersReducedMotion, starsFromCriterion, rankRows } from '../lib'

const A = '/assets/cubex/'
const GOLD_COLORS = ['#FFD166', '#F2B632', '#FFE8A3', '#FFFFFF', '#A96BFF']
const canHover = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches

/* ═══════════ الصفحة ═══════════ */
export default function Results() {
  const { slug } = useParams()
  return <LiveResults slug={slug} />
}

function LiveResults({ slug }) {
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState(null)
  const [criteria, setCriteria] = useState([])
  const [resultsError, setResultsError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const published = Boolean(event?.results_published)

  const loadEvent = useCallback(async () => {
    if (!isSupabaseActive) { setError('إعدادات Supabase غير مكتملة.'); setLoading(false); return }
    const { data, error: err } = await supabase.from('jd_events').select('*').eq('slug', slug).maybeSingle()
    if (err) setError(jdError(err))
    else if (!data) setError('الفعالية غير موجودة — تأكد من الرابط.')
    else { setError(''); setEvent(data) }
    setLoading(false)
  }, [slug])

  const loadResults = useCallback(async () => {
    setResultsError('')
    const [res, cr] = await Promise.all([
      supabase.rpc('jd_results', { p_slug: slug }),
      supabase.from('jd_criteria').select('id,name,weight,sort_order').eq('event_id', event?.id || '00000000-0000-0000-0000-000000000000').order('sort_order'),
    ])
    if (res.error) { setResultsError(jdError(res.error)); setRows([]); return }
    setRows(rankRows(res.data || []))
    setCriteria(cr.data || [])
  }, [slug, event?.id])

  useEffect(() => { loadEvent() }, [loadEvent])

  // جلسة أدمن؟ تظهر أزرار الكشف على الشاشة نفسها (RLS تحمي الكتابة)
  useEffect(() => {
    if (!isSupabaseActive) return
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setIsAdmin(Boolean(data?.session)) }).catch(() => {})
    return () => { active = false }
  }, [])

  // متابعة مباشرة لخطوة الكشف وحالة النشر + استعلام احتياطي كل 20 ثانية
  useEffect(() => {
    if (!isSupabaseActive || !event?.id) return
    const channel = supabase.channel(`jd_event_results_${slug}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jd_events', filter: `slug=eq.${slug}` }, (payload) => {
        setEvent(e => ({ ...(e || {}), ...payload.new }))
      })
      .subscribe()
    const timer = setInterval(async () => {
      const { data } = await supabase.from('jd_events').select('*').eq('slug', slug).maybeSingle()
      if (data) setEvent(e => (e && e.reveal_step === data.reveal_step && e.results_published === data.results_published && e.winners_count === data.winners_count && e.name === data.name) ? e : { ...e, ...data })
    }, 20000)
    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [slug, event?.id])

  useEffect(() => {
    if (published && rows === null) loadResults()
    if (!published && rows !== null) setRows(null)
  }, [published, rows, loadResults])

  const goStep = useCallback(async (s) => {
    const next = Math.max(0, Math.min(6, s))
    const { error: err } = await supabase.from('jd_events').update({ reveal_step: next }).eq('id', event.id)
    if (err) toast.err(jdError(err))
    else setEvent(e => ({ ...e, reveal_step: next }))
  }, [event?.id, toast])

  if (loading) return <Page nav={<JudgeNav />}><section className="jd-section"><Spinner label="جارٍ تحميل النتائج…" /></section></Page>
  if (error) return <Page nav={<JudgeNav />}><section className="jd-section"><ErrorBox onRetry={loadEvent}>{error}</ErrorBox></section></Page>

  if (!published) {
    const st = eventStatus(event)
    return (
      <Page nav={<JudgeNav />} narrow>
        <section className="jd-section">
          <div className="jd-panel jd-rise" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img src={A + 'cube-x.png'} alt="" style={{ width: 'min(160px,40%)', opacity: .95, filter: 'drop-shadow(0 0 30px rgba(150,76,255,.6))' }} />
            <p className="jd-kicker">RESULTS</p>
            <h1 className="jd-h2">لم تُعلن النتائج بعد</h1>
            <p className="jd-muted" style={{ maxWidth: '46ch', lineHeight: 1.85 }}>{event.name}<br />ستظهر النتائج هنا مباشرة فور إعلانها من المنظّمين — أبقِ هذه الصفحة مفتوحة.</p>
            <Badge cls={st.cls} dot={st.live}>{st.label}</Badge>
            <div className="jd-row" style={{ justifyContent: 'center' }}>
              <Link to="/judge" className="jd-link">الرئيسية</Link>
            </div>
          </div>
        </section>
      </Page>
    )
  }

  const step = Number(event.reveal_step || 0)
  const controls = isAdmin ? <StageControls step={step} onStep={goStep} label="تحكم الأدمن" /> : null
  if (step >= 1) return <><Stage event={event} rows={rows} criteria={criteria} step={Math.min(step, 6)} error={resultsError} onRetry={loadResults} />{controls}</>
  return <><NormalResults event={event} rows={rows} criteria={criteria} error={resultsError} onRetry={loadResults} />{controls}</>
}

/* الوضع العادي: المنصة ثابتة + الترتيب الكامل */
function NormalResults({ event, rows, criteria, error, onRetry }) {
  return (
    <Page nav={<JudgeNav />}>
      <section className="jd-section" style={{ paddingTop: 'clamp(28px,4vw,56px)' }}>
        <div className="jd-rise" style={{ textAlign: 'center' }}>
          <span className="jd-pill"><span className="dot" />النتائج النهائية</span>
          <h1 className="jd-title" style={{ fontSize: 'clamp(26px,3.6vw,48px)' }}>{event.name}</h1>
          <p className="jd-sub" style={{ marginTop: 8 }}>اضغط على بطاقة فائز لعرض درجته في كل معيار.</p>
        </div>
        {rows === null && <div className="jd-mt-lg"><Spinner label="جارٍ تحميل الترتيب…" /></div>}
        {rows !== null && error && <div className="jd-mt-lg"><ErrorBox onRetry={onRetry}>{error}</ErrorBox></div>}
        {rows !== null && !error && rows.length === 0 && <div className="jd-mt-lg"><EmptyState title="لا توجد نتائج" text="لم تُسجَّل تقييمات لهذه الفعالية." /></div>}
        {rows !== null && !error && rows.length > 0 && (
          <>
            <div className="jd-mt-lg jd-rise-2"><Podium rows={rows} criteria={criteria} animate={false} /></div>
            <h2 className="jd-h3 jd-mt-lg">الترتيب الكامل</h2>
            <p className="jd-sub">الدرجة من 100 لكل مشروع، ومتوسط النجوم في كل معيار.</p>
            <div className="jd-mt jd-rise-3"><Ranking rows={rows} criteria={criteria} winners={event.winners_count || 3} animate={false} /></div>
          </>
        )}
      </section>
    </Page>
  )
}

/* شريط التحكم على الشاشة (للأدمن، وفي وضع التجربة) */
function StageControls({ step, onStep, label, auto, onAuto, exitTo }) {
  const meta = REVEAL_STEPS[step] || REVEAL_STEPS[0]
  return (
    <div className="jd-stage-ctrl">
      <div>
        <span className="lbl"><Icon name="monitor" size={14} />{label} · {step}/6 — {meta.title}</span>
        <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={() => onStep(step - 1)} disabled={step <= 0}>السابق</button>
        <button type="button" className="jd-btn jd-btn-primary jd-btn-sm" onClick={() => onStep(step + 1)} disabled={step >= 6}>{step === 0 ? 'ابدأ الكشف' : 'الكشف التالي'}<Icon name="arrowLeft" size={14} /></button>
        {onAuto && <button type="button" className="jd-btn jd-btn-soft jd-btn-sm" onClick={onAuto}><Icon name={auto ? 'x' : 'play'} size={14} />{auto ? 'إيقاف التلقائي' : 'تشغيل تلقائي'}</button>}
        <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={() => onStep(0)} disabled={step === 0}>إعادة</button>
        {exitTo && <Link to={exitTo} className="jd-btn jd-btn-ghost jd-btn-sm">خروج</Link>}
      </div>
    </div>
  )
}

/* ═══════════ درجات المعايير كنجوم ═══════════ */
function criterionStars(row, criteria) {
  const names = criteria.length ? criteria.map(c => c.name) : Object.keys(row.per_criterion || {})
  const weightOf = (name) => Number(criteria.find(c => c.name === name)?.weight) || 20
  return names.map(name => {
    const v = row.per_criterion?.[name]
    const stars = v === undefined || v === null ? null : starsFromCriterion(v, weightOf(name))
    return { name, stars }
  }).filter(x => x.stars !== null)
}

function CriterionBars({ row, criteria, animate }) {
  const items = criterionStars(row, criteria)
  if (!items.length) return <p className="jd-small jd-dim">لا توجد تفاصيل لكل معيار.</p>
  return (
    <div className="jd-crit-bars">
      {items.map(it => (
        <div className="jd-crit-bar" key={it.name}>
          <div className="lbl"><span>{it.name}</span><b>{fmtScore(it.stars)} ★</b></div>
          <div className="trk"><div className="fil" style={{ width: animate ? `${(it.stars / 5) * 100}%` : `${(it.stars / 5) * 100}%` }} /></div>
        </div>
      ))}
      <p className="jd-small jd-dim" style={{ margin: 0 }}>{row.judges_count} محكّم · {fmtScore(row.final_score)} / 100</p>
    </div>
  )
}

/* ═══════════ بطاقة فائز قابلة للقلب: التحويم يقلبها مؤقتًا، والنقر يثبّتها ═══════════ */
function WinnerCard({ row, rank, criteria, size = 'sm', cardRef }) {
  const meta = RANK_META[rank] || { label: `المركز ${rank}`, cls: 'purple', medal: '', rank: 'jd-badge-purple' }
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const hoverable = canHover()
  const flipped = pinned || hover
  if (!row) {
    return <div className={`jd-wcard sz-${size} jd-podium-empty`} ref={cardRef}><span className={`jd-reveal-rank ${meta.rank}`}>{meta.label}</span><span className="team">—</span></div>
  }
  return (
    <div className={`jd-flip ${flipped ? 'is-flipped' : ''}`} ref={cardRef} role="button" tabIndex={0} aria-pressed={pinned} aria-label={`${meta.label}: ${row.team_name} — اضغط لعرض الدرجات`}
      onClick={() => setPinned(p => !p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned(p => !p) } }}
      onMouseEnter={hoverable ? () => setHover(true) : undefined} onMouseLeave={hoverable ? () => setHover(false) : undefined}>
      <div className="jd-flip-inner">
        <div className={`jd-flip-face jd-wcard sz-${size} rv-${meta.cls}`}>
          <span className={`jd-reveal-rank ${meta.rank}`} data-in="">{meta.label}</span>
          <div className={`jd-reveal-medal ${meta.medal}`} data-in="" style={size === 'sm' ? { width: 56, height: 56, fontSize: 26 } : undefined}>{rank}</div>
          <span className="team" data-in="">{row.team_name}</span>
          <span className="title" data-in="">{row.title}</span>
          <span className="score" data-in=""><b>{fmtScore(row.final_score)}</b> / 100</span>
          <span className="jd-flip-hint"><Icon name="refresh" size={11} />الدرجات</span>
        </div>
        <div className={`jd-flip-face jd-flip-back jd-wcard jd-wcard-back rv-${meta.cls}`}>
          <h4>{row.team_name} — الدرجة في كل معيار</h4>
          <CriterionBars row={row} criteria={criteria} animate={flipped} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════ المنصة: الأول في المنتصف، الثاني يسار، الثالث يمين ═══════════ */
function Podium({ rows, criteria, animate }) {
  const ref = useRef(null)
  const byRank = (r) => rows.find(x => Number(x.rank) === r)
  const order = [3, 1, 2] // في RTL: العمود الأول يمين (الثالث)، ثم المنتصف (الأول)، ثم يسار (الثاني)
  useLayoutEffect(() => {
    if (!animate || !ref.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from('.jd-podium-block', { scaleY: 0, duration: .9, ease: 'power3.out', stagger: { each: .25, from: 'end' } })
        .from('.jd-podium-card', { opacity: 0, y: 18, duration: .6, ease: 'power2.out', stagger: .15 }, '-=.4')
    }, ref)
    return () => ctx.revert()
  }, [animate])
  return (
    <div className="jd-podium" ref={ref}>
      {order.map(r => (
        <div key={r} className="jd-podium-col">
          <div className="jd-podium-card"><WinnerCard row={byRank(r)} rank={r} criteria={criteria} size="sm" /></div>
          <div className={`jd-podium-block p${r}`}>{r}</div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════ الترتيب الكامل ═══════════ */
function Ranking({ rows, criteria, winners = 3, animate }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (!animate || !ref.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from('.jd-rank-row', { opacity: 0, y: 22, duration: .6, ease: 'power2.out', stagger: .08 })
        .from('.jd-bar-fill', { scaleX: 0, duration: .8, ease: 'power3.out', stagger: .02 }, '-=.3')
    }, ref)
    return () => ctx.revert()
  }, [animate, rows])
  return (
    <div className="jd-rank-list" ref={ref}>
      {rows.map(r => {
        const rank = Number(r.rank)
        const meta = RANK_META[rank]
        const items = criterionStars(r, criteria)
        return (
          <div key={r.project_id} className={`jd-rank-row ${rank <= winners ? 'is-winner' : ''}`}>
            <div className={`jd-rank-num ${rank <= 3 ? `r${rank}` : ''}`}>{rank}</div>
            <div className="jd-rank-main">
              <b>{r.team_name}</b>
              <span>{r.title}</span>
              <div className="meta">
                <StageBadge stage={r.stage} />
                {rank <= winners && <Badge cls={meta ? meta.rank : 'jd-badge-purple'}>{meta ? meta.label : `المركز ${rank}`}</Badge>}
                <span className="jd-dim jd-small">{r.judges_count} محكّم</span>
              </div>
            </div>
            <div className="jd-rank-score"><b>{fmtScore(r.final_score)}</b><small>من 100</small></div>
            {items.length > 0 && (
              <div className="jd-rank-bars">
                {items.map(it => (
                  <div className="jd-bar" key={it.name}>
                    <div className="jd-bar-label"><span>{it.name}</span><b>{fmtScore(it.stars)} ★</b></div>
                    <div className="jd-bar-track"><div className="jd-bar-fill" style={{ width: `${(it.stars / 5) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════ وضع المسرح ═══════════ */
function Stage({ event, rows, criteria, step, error, onRetry }) {
  const reduced = prefersReducedMotion()
  const [shown, setShown] = useState(step)
  const viewRef = useRef(null)
  const [fs, setFs] = useState(false)

  useEffect(() => {
    if (shown === step) return
    if (reduced || !viewRef.current) { setShown(step); return }
    const ctx = gsap.context(() => {
      gsap.to(viewRef.current, { opacity: 0, y: -26, scale: .985, duration: .45, ease: 'power2.in', onComplete: () => setShown(step) })
    })
    return () => ctx.revert()
  }, [step, shown, reduced])
  useLayoutEffect(() => { if (viewRef.current) gsap.set(viewRef.current, { opacity: 1, y: 0, scale: 1 }) }, [shown])

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  function toggleFs() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen() } catch { /* غير مدعوم */ }
  }

  const byRank = (r) => (rows || []).find(x => Number(x.rank) === r)
  const waitingData = rows === null
  const winners = event.winners_count || 3

  return (
    <div className="jd-stage" dir="rtl">
      <div className={`jd-stage-bg ${shown === 5 ? 'gold' : ''}`} aria-hidden="true" />
      <div className="jd-stage-top">
        <div className="jd-stage-brand">
          <img src={A + 'cube-wire.png'} alt="" />
          <b>Cube<span>X</span></b>
          <span className="jd-dim jd-small" style={{ marginInlineStart: 8 }}>{event.name}</span>
        </div>
        <div className="jd-stage-tools">
          <span className="jd-badge jd-badge-purple jd-mono" title="خطوة الكشف الحالية">STEP {step}</span>
          <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={toggleFs}>{fs ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}</button>
        </div>
      </div>
      <div className="jd-stage-view" ref={viewRef} key={shown}>
        {error && <div style={{ width: 'min(100%, 640px)' }}><ErrorBox onRetry={onRetry}>{error}</ErrorBox></div>}
        {!error && shown === 1 && <Waiting event={event} />}
        {!error && shown === 2 && <Countdown />}
        {!error && (shown === 3 || shown === 4 || shown === 5) && (waitingData ? <Spinner plain label="جارٍ تحميل النتائج…" /> : <Reveal rank={6 - shown} row={byRank(6 - shown)} criteria={criteria} />)}
        {!error && shown === 6 && (waitingData ? <Spinner plain label="جارٍ تحميل النتائج…" /> : <FinalBoard rows={rows} criteria={criteria} winners={winners} />)}
      </div>
    </div>
  )
}

function Waiting({ event }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => { gsap.from(ref.current.children, { opacity: 0, y: 24, duration: .9, ease: 'power3.out', stagger: .18 }) }, ref)
    return () => ctx.revert()
  }, [])
  return (
    <div className="jd-stage-center" ref={ref}>
      <img className="jd-stage-logo" src={A + 'cube-wire.png'} alt="" />
      <p className="jd-stage-kicker">FINAL RESULTS</p>
      <h1 className="jd-stage-event">{event.name}</h1>
      <p className="jd-stage-final">النتائج النهائية</p>
    </div>
  )
}

function Countdown() {
  const ref = useRef(null)
  const [n, setN] = useState(3)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (prefersReducedMotion()) {
      const t1 = setTimeout(() => setN(2), 1000), t2 = setTimeout(() => setN(1), 2000), t3 = setTimeout(() => setDone(true), 3000)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      ;[3, 2, 1].forEach((v, i) => {
        tl.call(() => setN(v))
          .fromTo(ref.current, { scale: 2.6, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: 0, duration: .55, ease: 'back.out(1.6)' })
          .to(ref.current, { scale: .7, opacity: 0, duration: .35, ease: 'power2.in', delay: .45 })
        if (i === 2) tl.call(() => setDone(true))
      })
    })
    return () => ctx.revert()
  }, [])
  return (
    <div className="jd-stage-center">
      {!done && <div className="jd-count" ref={ref}>{n}</div>}
      {done && <p className="jd-stage-final" style={{ animation: 'jdBreath 2s ease-in-out infinite' }}>…</p>}
    </div>
  )
}

function Reveal({ rank, row, criteria }) {
  const wrapRef = useRef(null)
  useLayoutEffect(() => {
    if (!wrapRef.current) return
    if (prefersReducedMotion()) { if (rank === 1) fireGold(true); return }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from(wrapRef.current, { y: window.innerHeight, opacity: 0, duration: 1.15, ease: 'power4.out' })
        .from('[data-in]', { opacity: 0, y: 24, duration: .6, ease: 'power2.out', stagger: .14 }, '-=.5')
      if (rank === 1) tl.call(() => fireGold(false), null, '-=.3')
    }, wrapRef)
    return () => ctx.revert()
  }, [rank])
  if (!row) {
    return <div className="jd-stage-center"><p className="jd-stage-kicker">{RANK_META[rank]?.label}</p><p className="jd-muted">لا يوجد مشروع في هذا المركز.</p></div>
  }
  return (
    <div className="jd-podium-wrap" ref={wrapRef}>
      <WinnerCard row={row} rank={rank} criteria={criteria} size="lg" />
    </div>
  )
}

function fireGold(once) {
  try {
    const base = { colors: GOLD_COLORS, zIndex: 400, disableForReducedMotion: true }
    confetti({ ...base, particleCount: 160, spread: 90, origin: { y: .65 }, startVelocity: 55, scalar: 1.2 })
    if (once) return
    const end = Date.now() + 2600
    const frame = () => {
      confetti({ ...base, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: .7 } })
      confetti({ ...base, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: .7 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    setTimeout(() => confetti({ ...base, particleCount: 220, spread: 120, origin: { y: .5 }, startVelocity: 45, gravity: .9, scalar: 1.1 }), 900)
  } catch { /* الكونفيتي زينة فقط */ }
}

function FinalBoard({ rows, criteria, winners }) {
  const [showList, setShowList] = useState(prefersReducedMotion())
  const headRef = useRef(null)
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      if (headRef.current) tl.from(headRef.current, { opacity: 0, y: -18, duration: .7, ease: 'power2.out' })
      tl.call(() => setShowList(true), null, '+=1.8')
    })
    return () => ctx.revert()
  }, [])
  return (
    <div className="jd-stage-final-wrap">
      <div ref={headRef} style={{ textAlign: 'center' }}>
        <p className="jd-stage-kicker">WINNERS</p>
        <h2 className="jd-stage-event" style={{ fontSize: 'clamp(22px,3vw,44px)' }}>منصة التتويج</h2>
      </div>
      <Podium rows={rows} criteria={criteria} animate />
      {showList && (
        <div className="jd-stage-scroll">
          <h3 className="jd-h3" style={{ margin: '8px 0 12px', textAlign: 'center' }}>الترتيب الكامل</h3>
          <Ranking rows={rows} criteria={criteria} winners={winners} animate />
        </div>
      )}
    </div>
  )
}
