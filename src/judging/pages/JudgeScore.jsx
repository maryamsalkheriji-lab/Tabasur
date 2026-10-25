import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useJudge } from './JudgeArea'
import { Alert, EmptyState, Icon, LevelPicker } from '../components/ui'
import { jdError, prefersReducedMotion, SCORE_LABELS, criterionGuide, projectMeta } from '../lib'

const RETURN_MS = 2600
const NOTE_DEBOUNCE_MS = 900

/* تقييم مشروع: معيار واحد في كل شاشة — سؤال المعيار، أسئلة إرشادية، اختيار مستوى موصوف (1–5)، وسبب مختصر اختياري */
export default function JudgeScore() {
  const { projectId } = useParams()
  const { criteria } = useJudge()
  return <ScoreForm key={`${projectId}:${criteria.map(c => c.id).join(',')}`} />
}

function ScoreForm() {
  const { projectId, slug } = useParams()
  const navigate = useNavigate()
  const { event, criteria, projects, scores, saveScore } = useJudge()
  const project = projects.find(p => p.id === projectId)
  const closed = !event.judging_open
  const n = criteria.length

  const mine = useMemo(() => {
    const map = {}
    for (const s of scores) if (s.project_id === projectId) map[s.criterion_id] = s
    return map
  }, [scores, projectId])
  const scoredCount = criteria.filter(c => mine[c.id]).length
  const complete = n > 0 && scoredCount === n

  const [step, setStep] = useState(() => { const first = criteria.findIndex(c => !mine[c.id]); return first === -1 ? 0 : first })
  const [state, setState] = useState('')      // '' | 'saving' | 'saved' | 'error:…'
  const [notes, setNotes] = useState(() => Object.fromEntries(Object.values(mine).map(s => [s.criterion_id, s.note || ''])))
  const [done, setDone] = useState(false)
  const cardRef = useRef(null)
  const timers = useRef([])
  const noteTimer = useRef(null)
  const wasComplete = useRef(complete)
  const savingRef = useRef(null)

  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(noteTimer.current) }, [])
  useEffect(() => { setState(''); window.scrollTo({ top: 0 }) }, [step])
  useEffect(() => {
    if (!cardRef.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => { gsap.from(cardRef.current, { opacity: 0, y: 18, duration: .4, ease: 'power2.out' }) })
    return () => ctx.revert()
  }, [step])

  const later = useCallback((fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t) }, [])

  async function persist(cid, score, note) {
    if (closed) { setState('error:التحكيم غير مفتوح الآن — لا يمكن الحفظ.'); return false }
    if (savingRef.current) {
      await savingRef.current
      if (savingRef.current) return persist(cid, score, note)
    }
    setState('saving')
    const request = (async () => {
      try {
        await saveScore(projectId, cid, score, note)
        setState('saved')
        return true
      } catch (err) {
        setState(`error:${jdError(err)}`)
        return false
      }
    })()
    savingRef.current = request
    const ok = await request
    if (savingRef.current === request) savingRef.current = null
    return ok
  }

  async function pick(cid, value) {
    if (closed || savingRef.current) return
    clearTimeout(noteTimer.current)
    await persist(cid, value, notes[cid])
  }

  function onNote(cid, value) {
    setNotes(m => ({ ...m, [cid]: value }))
    clearTimeout(noteTimer.current)
    const current = mine[cid]
    if (!current) return // يُحفظ السبب مع الدرجة عند اختيارها
    noteTimer.current = setTimeout(() => persist(cid, current.score, value), NOTE_DEBOUNCE_MS)
  }
  async function flushNote(cid) {
    clearTimeout(noteTimer.current)
    if (savingRef.current && !await savingRef.current) return false
    const current = mine[cid]
    if (!current) return true
    const value = (notes[cid] ?? '').trim() || null
    if ((current.note || null) !== value) return persist(cid, current.score, value)
    return true
  }

  async function go(nextStep) {
    if (!await flushNote(criteria[step]?.id)) return
    setStep(nextStep)
  }
  async function returnToProjects(e) {
    e?.preventDefault()
    if (!await flushNote(criteria[step]?.id)) return
    navigate(`/judge/${slug}/judge`)
  }
  async function finish() {
    if (!await flushNote(criteria[step]?.id)) return
    if (complete && !wasComplete.current) { wasComplete.current = true; setDone(true) }
    else navigate(`/judge/${slug}/judge`)
  }

  useEffect(() => {
    if (!done) return
    later(() => navigate(`/judge/${slug}/judge`), RETURN_MS)
  }, [done, later, navigate, slug])

  if (!project) {
    return <section className="jd-section"><EmptyState icon="search" title="المشروع غير موجود" text="ربما حُذف أو لم يعد مؤهلًا للتحكيم." action={<Link to={`/judge/${slug}/judge`} className="jd-btn jd-btn-soft">العودة للقائمة</Link>} /></section>
  }
  if (closed) return <Navigate to={`/judge/${slug}/judge`} replace />
  if (n === 0) return <section className="jd-section"><Alert kind="warn">لا توجد معايير تقييم لهذه الفعالية بعد — تواصل مع المنظّمين.</Alert></section>

  if (done) {
    return (
      <section className="jd-section">
        <div className="jd-stepper">
          <div className="jd-complete jd-rise">
            <span className="jd-state-icon"><Icon name="check" size={30} /></span>
            <h2>اكتمل تقييمك لفريق «{project.team_name}»</h2>
            <p>شكرًا لك. درجاتك محفوظة، ويمكنك الرجوع وتعديلها ما دام التحكيم مفتوحًا.</p>
            <div className="jd-auto-bar" aria-hidden="true"><i /></div>
            <Link to={`/judge/${slug}/judge`} className="jd-btn jd-btn-primary">العودة للمشاريع الآن<Icon name="arrowLeft" size={16} /></Link>
          </div>
        </div>
      </section>
    )
  }

  const c = criteria[step]
  const current = mine[c.id]
  const guide = criterionGuide(c)
  const isErr = state.startsWith('error:')
  const isLast = step === n - 1

  return (
    <section style={{ padding: 'clamp(18px,3vw,28px) 0 48px' }}>
      <div className="jd-stepper">
        <div className="jd-row jd-row-between">
          <Link to={`/judge/${slug}/judge`} className="jd-link" onClick={returnToProjects}><Icon name="arrowRight" size={16} />المشاريع</Link>
          <span className="jd-small jd-dim">{scoredCount}/{n} معايير</span>
        </div>
        <div className="jd-project-head">
          <b>{project.team_name}</b>
          <small>{projectMeta(project) || project.title}</small>
        </div>
        <div className="jd-step-dots" aria-hidden="true">
          {criteria.map((x, i) => <span key={x.id} className={`jd-step-dot ${mine[x.id] ? 'is-done' : ''} ${i === step ? 'is-active' : ''}`} />)}
        </div>

        {closed && <Alert kind="warn" icon="lock">التحكيم غير مفتوح الآن — الدرجات للعرض فقط.</Alert>}

        <div className="jd-question" ref={cardRef} key={c.id}>
          <span className="idx">المعيار {step + 1} من {n}</span>
          <h1>{c.name}</h1>
          {c.description && <p className="ask"><b>ما الذي تقيّمه هنا؟</b> {c.description}</p>}
          {guide.questions.length > 0 && (
            <div className="jd-guide-q">
              <b><Icon name="info" size={13} />أسئلة تساعدك على الحكم</b>
              <ul>{guide.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {guide.note && <p className="jd-guide-note">{guide.note}</p>}
          <LevelPicker value={current?.score} onChange={(v) => pick(c.id, v)} disabled={closed || state === 'saving'} levels={guide.levels} label={`مستوى ${c.name}`} />
          <textarea className="jd-textarea jd-reason" placeholder={current ? 'سبب مختصر لدرجتك (اختياري)…' : 'اختر المستوى أولًا، ثم أضف سببًا مختصرًا (اختياري)'} value={notes[c.id] ?? ''} onChange={e => onNote(c.id, e.target.value)} disabled={closed || !current || state === 'saving'} maxLength={500} />
          <div className={`jd-save-state ${state === 'saved' ? 'ok' : isErr ? 'err' : ''}`} aria-live="polite" style={{ justifyContent: 'center' }}>
            {state === 'saving' && <><span className="jd-spinner jd-spinner-sm" /> جارٍ الحفظ…</>}
            {state === 'saved' && <><Icon name="check" size={14} /> تم الحفظ</>}
            {isErr && state.slice(6)}
            {!state && current && <span className="jd-dim">تقييمك: {current.score} · {SCORE_LABELS[current.score]}</span>}
            {!state && !current && <span className="jd-dim">اختر المستوى الذي يصف هذا المشروع</span>}
          </div>
        </div>

        <div className="jd-step-nav">
          <button type="button" className="jd-btn jd-btn-ghost" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0 || state === 'saving'}><Icon name="arrowRight" size={16} />السابق</button>
          {!isLast
            ? <button type="button" className={`jd-btn ${current ? 'jd-btn-primary' : 'jd-btn-soft'}`} onClick={() => go(Math.min(n - 1, step + 1))} disabled={!current || state === 'saving'}>التالي<Icon name="arrowLeft" size={16} /></button>
            : <button type="button" className={`jd-btn ${complete ? 'jd-btn-green' : 'jd-btn-soft'}`} onClick={finish} disabled={!current || state === 'saving'}>{complete ? <><Icon name="check" size={16} />إنهاء التقييم</> : 'العودة للمشاريع'}</button>}
        </div>
        <p className="jd-coi">إن كان لديك تعارض مصالح مع هذا الفريق فلا تقيّمه وأبلغ المنظّمين. سجّل درجاتك باستقلال قبل أي نقاش.</p>
      </div>
    </section>
  )
}
