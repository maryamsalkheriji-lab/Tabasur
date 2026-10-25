import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import confetti from 'canvas-confetti'
import { getJudgeSession } from '../judgeClient'
import { supabase, isSupabaseActive } from '../../lib/supabase'
import { JudgeNav, Page, Spinner, ErrorBox, EmptyState, Badge, Icon } from '../components/ui'
import { RANK_META, eventStatus, fmtScore, jdError, prefersReducedMotion, rankRows } from '../lib'

const A = '/assets/cubex/'
/* ألوان الكونفيتي لكل مركز */
const PALETTE = {
  1: ['#FFD166', '#F2B632', '#FFE8A3', '#FFFFFF', '#A96BFF'],
  2: ['#F4F5F8', '#C9CDD8', '#FFFFFF', '#A96BFF', '#D6D9E2'],
  3: ['#F3C9A4', '#D9915A', '#FFE0C2', '#FFFFFF', '#A96BFF'],
}
/* مراحل الحفل على الشاشة:
   0 الثالث مغلق · 1 الثالث مكشوف · 2 الثاني مغلق · 3 الثاني مكشوف · 4 الأول مغلق · 5 الأول مكشوف · 6 منصة التتويج */
const FINAL = 6
const RANK_ORDER = [3, 2, 1]
const viewOf = (stage) => Math.min(3, Math.floor(stage / 2)) // 0 الثالث · 1 الثاني · 2 الأول · 3 المنصة
/* خطوة الريموت (reveal_step في قاعدة البيانات) ← مرحلة الشاشة. الخطوة 0 تترك التحكم للشاشة نفسها */
const stageFromStep = (step) => ({ 1: 0, 2: 2, 3: 4, 4: 6 })[Number(step)] ?? null
const NEXT_LABEL = { 0: 'الكشف عن المركز الثاني', 1: 'الكشف عن المركز الأول', 2: 'عرض منصة التتويج' }

/* ═══════════ الصفحة ═══════════ */
export default function Results() {
  const { slug } = useParams()
  const session = getJudgeSession()
  if (session?.token) return <Navigate to={`/judge/${session.slug}/judge`} replace />
  return <LiveResults slug={slug} />
}

function LiveResults({ slug }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState(null)
  const [resultsError, setResultsError] = useState('')
  const published = Boolean(event?.results_published)

  const loadEvent = useCallback(async () => {
    if (!isSupabaseActive) { setError('إعدادات Supabase غير مكتملة.'); setLoading(false); return }
    const { data, error: err } = await supabase.from('jd_events').select('*').eq('slug', slug).maybeSingle()
    if (err) setError(jdError(err))
    else if (!data) setError('الفعالية غير موجودة — تأكد من الرابط.')
    else { setError(''); setEvent(data) }
    setLoading(false)
  }, [slug])

  /* الأسماء والدرجات فقط — لا تُجلب المعايير ولا تُعرض */
  const loadResults = useCallback(async () => {
    setResultsError('')
    const res = await supabase.rpc('jd_results', { p_slug: slug })
    if (res.error) { setResultsError(jdError(res.error)); setRows([]); return }
    setRows(rankRows(res.data || []))
  }, [slug])

  useEffect(() => { loadEvent() }, [loadEvent])

  // متابعة مباشرة لحالة النشر وخطوة الريموت + استعلام احتياطي كل 20 ثانية
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

  return <Ceremony event={event} rows={rows} error={resultsError} onRetry={loadResults} />
}

/* ═══════════ حفل الكشف: الثالث ← الثاني ← الأول ← منصة التتويج ═══════════ */
function Ceremony({ event, rows, error, onRetry }) {
  const reduced = prefersReducedMotion()
  const [stage, setStage] = useState(() => stageFromStep(event.reveal_step) ?? 0)
  const [fs, setFs] = useState(false)
  const lockRef = useRef(0)
  const viewRef = useRef(null)
  const view = viewOf(stage)
  const [shownView, setShownView] = useState(view) // ما يُعرض فعليًا (بعد انتهاء حركة الخروج)

  // الريموت: تغيّر reveal_step من لوحة الأدمن يضبط المرحلة على كل الشاشات المفتوحة
  useEffect(() => { const s = stageFromStep(event.reveal_step); if (s !== null) setStage(s) }, [event.reveal_step])

  // حارس بسيط ضد النقر المزدوج أثناء الحركة
  const go = useCallback((next) => {
    const now = Date.now()
    if (now < lockRef.current) return
    lockRef.current = now + 900
    setStage(s => Math.max(0, Math.min(FINAL, typeof next === 'function' ? next(s) : next)))
  }, [])
  const advance = useCallback(() => go(s => s + 1), [go])
  const back = useCallback(() => go(s => s - 1), [go])

  // لوحة المفاتيح وجهاز التقديم: مسافة / Enter / الأسهم / PageDown = التالي · PageUp / سهم أعلى / Backspace = السابق
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return
      if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); advance() }
      else if (['PageUp', 'ArrowUp', 'Backspace'].includes(e.key)) { e.preventDefault(); back() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, back])

  // الانتقال بين البطاقات: خروج ناعم ثم دخول البطاقة التالية
  useEffect(() => {
    if (shownView === view) return
    if (reduced || !viewRef.current) { setShownView(view); return }
    const ctx = gsap.context(() => {
      gsap.to(viewRef.current, { opacity: 0, y: -34, scale: .97, duration: .42, ease: 'power2.in', onComplete: () => setShownView(view) })
    })
    return () => ctx.revert()
  }, [view, shownView, reduced])
  useLayoutEffect(() => {
    if (!viewRef.current) return
    gsap.set(viewRef.current, { opacity: 1, y: 0, scale: 1 })
    if (!reduced) gsap.from(viewRef.current, { opacity: 0, y: 40, duration: .6, ease: 'power3.out' })
  }, [shownView, reduced])

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  function toggleFs() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen() } catch { /* غير مدعوم */ }
  }

  const cardOpen = shownView === view ? stage % 2 === 1 : shownView < view
  const rank = RANK_ORDER[shownView]
  const row = rank ? (rows || []).find(x => Number(x.rank) === rank) : null
  const revealedBefore = RANK_ORDER.slice(0, Math.min(shownView, 3))
  const ready = !error && Array.isArray(rows) && rows.length > 0
  const winners = event.winners_count || 3

  return (
    <div className="jd-stage" dir="rtl">
      <div className={`jd-stage-bg ${stage >= 5 ? 'gold' : ''}`} aria-hidden="true" />
      <div className="jd-stage-top">
        <div className="jd-stage-brand">
          <img src={A + 'cube-wire.png'} alt="" />
          <b>Cube<span>X</span></b>
          <span className="jd-dim jd-small jd-stage-evname" style={{ marginInlineStart: 8 }}>{event.name}</span>
        </div>
        <div className="jd-stage-tools">
          {stage > 0 && <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={() => go(0)}><Icon name="refresh" size={14} />إعادة</button>}
          {stage < FINAL && <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={() => go(FINAL)}>تخطّي إلى الترتيب</button>}
          <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={toggleFs}>{fs ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}</button>
        </div>
      </div>

      <div className="jd-stage-view" ref={viewRef} key={shownView}>
        {error && <div style={{ width: 'min(100%, 640px)' }}><ErrorBox onRetry={onRetry}>{error}</ErrorBox></div>}
        {!error && rows === null && <Spinner plain label="جارٍ تحميل النتائج…" />}
        {!error && Array.isArray(rows) && rows.length === 0 && <EmptyState title="لا توجد نتائج" text="لم تُسجَّل تقييمات لهذه الفعالية." />}
        {ready && shownView < 3 && (
          <div className="jd-cer">
            <div className="jd-cer-head">
              <p className="jd-stage-kicker">FINAL RESULTS</p>
              <Steps view={shownView} open={cardOpen} />
            </div>
            <SealCard key={rank} rank={rank} row={row} open={cardOpen} onOpen={advance} reduced={reduced} />
            {cardOpen && shownView === view && (
              <button type="button" className={`jd-btn jd-btn-primary jd-btn-lg jd-next ${reduced ? '' : 'jd-next-delay'}`} onClick={advance}>
                {NEXT_LABEL[shownView]}<Icon name="arrowLeft" size={16} />
              </button>
            )}
          </div>
        )}
        {ready && shownView === 3 && <FinalBoard rows={rows} winners={winners} reduced={reduced} />}
      </div>

      {ready && shownView < 3 && revealedBefore.length > 0 && <Tray rows={rows} ranks={revealedBefore} />}
    </div>
  )
}

/* مؤشر التسلسل: ٣ ← ٢ ← ١ */
function Steps({ view, open }) {
  return (
    <div className="jd-steps" aria-hidden="true">
      {RANK_ORDER.map((r, i) => (
        <span key={r} className="jd-steps-item">
          <i className={`m${r} ${i < view || (i === view && open) ? 'is-done' : ''} ${i === view ? 'is-now' : ''}`}>{r}</i>
          {i < RANK_ORDER.length - 1 && <s />}
        </span>
      ))}
    </div>
  )
}

/* البطاقة المغلقة: الضغط يقلبها ويكشف الفائز مع كونفيتي وعدّاد للدرجة */
function SealCard({ rank, row, open, onOpen, reduced }) {
  const meta = RANK_META[rank]
  const ref = useRef(null)
  const scoreRef = useRef(null)
  const [charging, setCharging] = useState(false)
  const firedRef = useRef(false)
  const score = Number(row?.final_score) || 0

  useEffect(() => {
    if (!open) { firedRef.current = false; return }
    if (firedRef.current) return
    firedRef.current = true
    if (reduced) { if (scoreRef.current) scoreRef.current.textContent = fmtScore(score); return }
    const counter = { v: 0 }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.call(() => celebrate(rank), null, .5)
        .from('[data-in]', { opacity: 0, y: 26, duration: .6, ease: 'power3.out', stagger: .12 }, .65)
        .to(counter, { v: score, duration: 1.4, ease: 'power2.out', onUpdate: () => { if (scoreRef.current) scoreRef.current.textContent = fmtScore(counter.v) } }, .95)
    }, ref)
    return () => ctx.revert()
  }, [open, rank, score, reduced])

  function handleClick() {
    if (open || charging) return
    if (reduced) { onOpen(); return }
    setCharging(true)
    setTimeout(() => { setCharging(false); onOpen() }, 320)
  }

  return (
    <div className={`jd-seal rv-${meta.cls} ${open ? 'is-open' : ''} ${charging ? 'is-charging' : ''}`} ref={ref}
      role="button" tabIndex={open ? -1 : 0} aria-label={open ? `${meta.label}: ${row?.team_name || '—'}` : `${meta.label} — اضغط للكشف عن الفائز`} onClick={handleClick}>
      <div className="jd-seal-inner">
        <div className="jd-seal-face jd-seal-front" aria-hidden={open}>
          <span className={`jd-reveal-rank jd-seal-rank ${meta.rank}`}>{meta.label}</span>
          <div className={`jd-reveal-medal ${meta.medal}`}>{rank}</div>
          <span className="jd-seal-q">مَن صاحب {meta.label}؟</span>
          <span className="jd-seal-hint"><span className="dot" />اضغط للكشف عن الفائز</span>
        </div>
        <div className="jd-seal-face jd-seal-back" aria-hidden={!open}>
          <span className={`jd-reveal-rank jd-seal-rank ${meta.rank}`} data-in="">{meta.label}</span>
          <div className={`jd-reveal-medal ${meta.medal}`} data-in="">{rank}</div>
          {row ? (
            <>
              <span className="jd-seal-team" data-in="">{row.team_name}</span>
              <span className="jd-seal-title" data-in="">{row.title}</span>
              <span className="jd-seal-score" data-in=""><b ref={scoreRef}>{reduced ? fmtScore(score) : '0.0'}</b><span>/ 100</span></span>
            </>
          ) : <span className="jd-seal-title" data-in="">لا يوجد مشروع في هذا المركز.</span>}
        </div>
      </div>
      {open && row && <span className="jd-sr" aria-live="polite">{meta.label}: {row.team_name} — {fmtScore(score)} من 100</span>}
    </div>
  )
}

/* كونفيتي بلون المركز — الأول يحصل على ألعاب نارية ممتدة */
function celebrate(rank) {
  try {
    const base = { colors: PALETTE[rank] || PALETTE[3], zIndex: 400, disableForReducedMotion: true }
    if (rank === 1) {
      confetti({ ...base, particleCount: 220, spread: 100, origin: { y: .6 }, startVelocity: 62, scalar: 1.25 })
      const end = Date.now() + 4200
      const frame = () => {
        confetti({ ...base, particleCount: 7, angle: 60, spread: 65, origin: { x: 0, y: .75 } })
        confetti({ ...base, particleCount: 7, angle: 120, spread: 65, origin: { x: 1, y: .75 } })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
      let shots = 0
      const iv = setInterval(() => {
        confetti({ ...base, particleCount: 90, spread: 360, startVelocity: 36, gravity: .8, ticks: 130, scalar: 1.1, origin: { x: .2 + Math.random() * .6, y: .15 + Math.random() * .35 } })
        if (++shots >= 7) clearInterval(iv)
      }, 480)
      return
    }
    confetti({ ...base, particleCount: rank === 2 ? 160 : 120, spread: 85, origin: { y: .62 }, startVelocity: 52, scalar: 1.15 })
    setTimeout(() => {
      confetti({ ...base, particleCount: 55, angle: 60, spread: 55, origin: { x: 0, y: .7 } })
      confetti({ ...base, particleCount: 55, angle: 120, spread: 55, origin: { x: 1, y: .7 } })
    }, 260)
  } catch { /* الكونفيتي زينة فقط */ }
}

/* الدرج السفلي: المراكز المكشوفة سابقًا تبقى ظاهرة */
function Tray({ rows, ranks }) {
  return (
    <div className="jd-tray" aria-label="المراكز المكشوفة">
      {ranks.map(r => {
        const row = rows.find(x => Number(x.rank) === r)
        const meta = RANK_META[r]
        return (
          <div key={r} className="jd-tray-chip">
            <i className={meta.medal}>{r}</i>
            <span className="lbl">{meta.label}</span>
            <b>{row?.team_name || '—'}</b>
            {row && <small>{fmtScore(row.final_score)}</small>}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════ منصة التتويج: الثلاثة معًا ثم الترتيب الكامل ═══════════ */
function FinalBoard({ rows, winners, reduced }) {
  const [showList, setShowList] = useState(reduced)
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (reduced || !ref.current) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from('.jd-final-head', { opacity: 0, y: -18, duration: .7, ease: 'power2.out' })
        .from('.jd-podium-block', { scaleY: 0, duration: .9, ease: 'power3.out', stagger: { each: .22, from: 'end' } }, '-=.3')
        .from('.jd-pod-card', { opacity: 0, y: 22, duration: .6, ease: 'power2.out', stagger: .15 }, '-=.5')
        .call(() => setShowList(true), null, '+=1.1')
    }, ref)
    return () => ctx.revert()
  }, [reduced])
  const byRank = (r) => rows.find(x => Number(x.rank) === r)
  return (
    <div className="jd-stage-final-wrap" ref={ref}>
      <div className="jd-final-head">
        <p className="jd-stage-kicker">WINNERS</p>
        <h2 className="jd-stage-event" style={{ fontSize: 'clamp(22px,3vw,44px)' }}>منصة التتويج</h2>
      </div>
      {/* في RTL: العمود الأول يمين (الثالث)، المنتصف (الأول)، يسار (الثاني) */}
      <div className="jd-podium">
        {[3, 1, 2].map(r => (
          <div key={r} className="jd-podium-col">
            <PodCard row={byRank(r)} rank={r} />
            <div className={`jd-podium-block p${r}`}>{r}</div>
          </div>
        ))}
      </div>
      {showList && <Ranking rows={rows} winners={winners} reduced={reduced} />}
    </div>
  )
}

function PodCard({ row, rank }) {
  const meta = RANK_META[rank]
  return (
    <div className={`jd-pod-card rv-${meta.cls} ${row ? '' : 'jd-podium-empty'}`}>
      <span className={`jd-reveal-rank ${meta.rank}`}>{meta.label}</span>
      <div className={`jd-reveal-medal sm ${meta.medal}`}>{rank}</div>
      <span className="team">{row?.team_name || '—'}</span>
      {row && <span className="title">{row.title}</span>}
      {row && <span className="score"><b>{fmtScore(row.final_score)}</b> / 100</span>}
    </div>
  )
}

/* الترتيب الكامل: الرقم، الفريق، المشروع، الدرجة من 100 — بلا معايير */
function Ranking({ rows, winners, reduced }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (reduced || !ref.current) return
    const ctx = gsap.context(() => {
      gsap.from('.jd-rank-row', { opacity: 0, y: 22, duration: .55, ease: 'power2.out', stagger: .07 })
      gsap.from('.jd-rank-bar i', { scaleX: 0, duration: .9, ease: 'power3.out', stagger: .07, delay: .3 })
    }, ref)
    return () => ctx.revert()
  }, [reduced, rows])
  return (
    <div className="jd-final-sec" ref={ref}>
      <h3 className="jd-h3">الترتيب الكامل</h3>
      <div className="jd-rank-list">
        {rows.map(r => {
          const rank = Number(r.rank)
          const meta = RANK_META[rank]
          const pct = Math.max(0, Math.min(100, Number(r.final_score) || 0))
          return (
            <div key={r.project_id} className={`jd-rank-row ${rank <= winners ? 'is-winner' : ''} ${rank <= 3 ? `is-r${rank}` : ''}`}>
              <div className={`jd-rank-num ${rank <= 3 ? `r${rank}` : ''}`}>{rank}</div>
              <div className="jd-rank-main">
                <b>{r.team_name}</b>
                <span>{r.title}</span>
                {rank <= winners && <div className="meta"><Badge cls={meta ? meta.rank : 'jd-badge-purple'}>{meta ? meta.label : 'فائز'}</Badge></div>}
              </div>
              <div className="jd-rank-score"><b>{fmtScore(r.final_score)}</b><small>من 100</small></div>
              <div className="jd-rank-bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
