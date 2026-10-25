import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { supabase, isSupabaseActive } from '../../lib/supabase'
import { getJudgeSession, judgeSupabase, judgeLogout, judgeSessionExpired } from '../judgeClient'
import { JudgeNav, Page, Spinner, ErrorBox, Badge } from '../components/ui'
import { eventStatus, jdError, projectStatus } from '../lib'

export function useJudge() { return useOutletContext() }

/* غلاف لوحة المحكّم: الجلسة + تحميل الفعالية والمعايير والمشاريع والتقييمات + الحفظ */
export default function JudgeArea() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const session = useMemo(() => getJudgeSession(), [])
  const client = useMemo(() => judgeSupabase(), [])
  const [data, setData] = useState({ event: null, criteria: [], projects: [], scores: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const valid = Boolean(session?.token && session.slug === slug && client && !judgeSessionExpired())
  const reloadingRef = useRef(false)

  const logout = useCallback(() => {
    judgeLogout()
    navigate(`/judge/${slug}`, { replace: true })
  }, [navigate, slug])

  const load = useCallback(async (silent = false) => {
    if (!valid) return
    if (judgeSessionExpired()) { logout(); return }
    if (reloadingRef.current) return
    reloadingRef.current = true
    if (!silent) { setLoading(true); setError('') }
    try {
      const [ev, cr, pr, sc] = await Promise.all([
        client.from('jd_events').select('*').eq('id', session.event_id).maybeSingle(),
        client.from('jd_criteria').select('id,event_id,name,description,sort_order').eq('event_id', session.event_id).order('sort_order', { ascending: true }),
        client.from('jd_projects').select('id,event_id,team_name,title,track,team_size,eligible,sort_order').eq('event_id', session.event_id).order('sort_order', { ascending: true }),
        client.from('jd_scores').select('*').eq('judge_id', session.judge.id),
      ])
      const firstErr = [ev, cr, pr, sc].find(r => r.error)?.error
      if (firstErr) {
        if (/jwt|expired|invalid token/i.test(firstErr.message || '')) { logout(); return }
        throw firstErr
      }
      if (!ev.data) throw new Error('الفعالية غير موجودة أو لا تملك صلاحية الوصول إليها.')
      setData({ event: ev.data, criteria: cr.data || [], projects: (pr.data || []).filter(p => p.eligible !== false), scores: sc.data || [] })
    } catch (err) {
      if (!silent) setError(jdError(err))
    } finally {
      reloadingRef.current = false
      if (!silent) setLoading(false)
    }
  }, [client, session, valid, logout])

  useEffect(() => {
    if (!valid) { judgeLogout(); navigate(`/judge/${slug}`, { replace: true }); return }
    load()
  }, [valid, load, navigate, slug])

  // متابعة فتح/إغلاق التحكيم مباشرة + إعادة تحميل عند العودة للتبويب
  useEffect(() => {
    if (!valid || !isSupabaseActive) return
    const channel = supabase.channel(`jd_event_judge_${slug}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jd_events', filter: `slug=eq.${slug}` }, (payload) => {
        setData(d => d.event ? { ...d, event: { ...d.event, ...payload.new } } : d)
        load(true)
      })
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') load(true) }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true) }, 20000)
    return () => { clearInterval(timer); supabase.removeChannel(channel); document.removeEventListener('visibilitychange', onVisible) }
  }, [valid, slug, load])

  /* حفظ درجة معيار فورًا: upsert في jd_scores (أو sessionStorage في وضع التجربة) */
  const saveScore = useCallback(async (projectId, criterionId, score, note) => {
    const row = { judge_id: session.judge.id, project_id: projectId, criterion_id: criterionId, score, note: (note || '').trim() || null }
    const { data: d, error: err } = await client.from('jd_scores').upsert(row, { onConflict: 'judge_id,project_id,criterion_id' }).select().single()
    if (err) {
      if (/row-level security/i.test(err.message || '')) load(true)
      throw err
    }
    const saved = d || { ...row, updated_at: new Date().toISOString() }
    setData(d => {
      const idx = d.scores.findIndex(s => s.project_id === saved.project_id && s.criterion_id === saved.criterion_id)
      const scores = d.scores.slice()
      if (idx === -1) scores.push(saved); else scores[idx] = { ...scores[idx], ...saved }
      return { ...d, scores }
    })
    return saved
  }, [client, session, load])

  const statuses = useMemo(() => Object.fromEntries(data.projects.map(p => [p.id, projectStatus(p.id, data.criteria, data.scores)])), [data])
  const doneCount = useMemo(() => Object.values(statuses).filter(s => s === 'complete').length, [statuses])

  const nav = (
    <JudgeNav links={[{ label: 'خروج', onClick: logout }]}>
      {data.event && (() => { const st = eventStatus(data.event); return <Badge cls={st.cls} dot={st.live}>{st.label}</Badge> })()}
    </JudgeNav>
  )

  if (!valid) return null
  if (loading) return <Page nav={nav} mid><section className="jd-section"><Spinner label="جارٍ تحميل لوحة التحكيم…" /></section></Page>
  if (error) return <Page nav={nav} mid><section className="jd-section"><ErrorBox onRetry={() => load()}>{error}</ErrorBox></section></Page>

  return (
    <Page nav={nav} mid>
      <Outlet context={{ session, client, ...data, statuses, doneCount, saveScore, reload: load, logout, slug }} />
    </Page>
  )
}
