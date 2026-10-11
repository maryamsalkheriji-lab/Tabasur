import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner, ErrorBox, EmptyState, StageBadge, Icon, HelpBox } from '../components/ui'
import { jdError, fmtScore, starsFromCriterion, rankRows } from '../lib'

/* الترتيب الحي: يُحسب في قاعدة البيانات (jd_results) ويظهر للأدمن حتى قبل النشر */
export default function LiveResults({ supabase, event }) {
  const [rows, setRows] = useState(null)
  const [criteria, setCriteria] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [res, cr] = await Promise.all([
      supabase.rpc('jd_results', { p_slug: event.slug }),
      supabase.from('jd_criteria').select('id,name,weight,sort_order').eq('event_id', event.id).order('sort_order'),
    ])
    if (res.error) { setError(jdError(res.error)); setRows([]) }
    else setRows(rankRows(res.data || []))
    setCriteria(cr.data || [])
    setLoading(false)
  }, [supabase, event.slug, event.id])
  useEffect(() => { load() }, [load])

  const names = criteria.length ? criteria.map(c => c.name) : []
  const weightOf = (name) => Number(criteria.find(c => c.name === name)?.weight) || 20

  return (
    <div className="jd-stack" style={{ gap: 16 }}>
      <HelpBox title="كيف تُحسب الدرجة؟">
        درجة المعيار = الدرجة (1–5) ÷ 5 × وزن المعيار، والنتيجة النهائية من 100 هي متوسط مجموع درجات المحكّمين — تُحسب في قاعدة البيانات. عند التعادل يُقدَّم الأعلى في «الاختبار والتعلّم» ثم «جودة الـMVP» (وفق وثيقة المعايير). لا يراها المحكّمون ولا العامة قبل النشر.
      </HelpBox>
      <div className="jd-row jd-row-between">
        <p className="jd-muted jd-small">{event.results_published ? 'النتائج منشورة للعامة.' : 'غير منشورة بعد — يراها الأدمن فقط.'}</p>
        <div className="jd-row">
          <Link to={`/judge/${event.slug}/results`} target="_blank" rel="noopener noreferrer" className="jd-btn jd-btn-ghost jd-btn-sm"><Icon name="external" size={14} />صفحة النتائج</Link>
          <button type="button" className="jd-btn jd-btn-soft jd-btn-sm" onClick={load} disabled={loading}><Icon name="refresh" size={14} />{loading ? '…' : 'تحديث'}</button>
        </div>
      </div>
      {rows === null || loading ? <Spinner label="جارٍ حساب الترتيب…" /> : error ? <ErrorBox onRetry={load}>{error}</ErrorBox> : rows.length === 0 ? (
        <EmptyState icon="chart" title="لا توجد نتائج بعد" text="تظهر النتائج بعد أن يسجّل المحكّمون نجومهم." />
      ) : (
        <div className="jd-table-wrap">
          <table className="jd-table">
            <thead><tr><th className="w-num">#</th><th>الفريق</th><th>المشروع</th><th>المرحلة</th><th className="w-num">الدرجة /100</th><th className="w-num">محكّمون</th>{names.map(n => <th key={n} className="w-num" title={n}>{n.replace(/^هل\s+/, '').replace(/؟$/, '')}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.project_id}>
                  <td className="num"><b style={{ color: Number(r.rank) <= (event.winners_count || 3) ? 'var(--jd-gold)' : '#fff' }}>{r.rank}</b></td>
                  <td><b style={{ color: '#fff' }}>{r.team_name}</b></td>
                  <td>{r.title}</td>
                  <td><StageBadge stage={r.stage} /></td>
                  <td className="num"><b style={{ color: '#fff' }}>{fmtScore(r.final_score)}</b></td>
                  <td className="num">{r.judges_count}</td>
                  {names.map(n => { const st = starsFromCriterion(r.per_criterion?.[n], weightOf(n)); return <td key={n} className="num muted">{st === null ? '—' : `${fmtScore(st)} ★`}</td> })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
