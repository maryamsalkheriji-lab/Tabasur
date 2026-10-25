import { useCallback, useEffect, useState } from 'react'
import { Spinner, ErrorBox, EmptyState, Modal, Field, Badge, ConfirmDialog, Alert, HelpBox, Icon, Ring } from '../components/ui'
import { jdError, fmtDateTime, inviteLink, copyText } from '../lib'

export default function Judges({ supabase, event, toast }) {
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState({})
  const [projectsCount, setProjectsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [days, setDays] = useState(14)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [judges, criteria, projects] = await Promise.all([
      supabase.from('jd_judges').select('id,event_id,name,expires_at,revoked,last_login_at,created_at').eq('event_id', event.id).order('created_at', { ascending: true }),
      supabase.from('jd_criteria').select('id').eq('event_id', event.id),
      supabase.from('jd_projects').select('id,eligible').eq('event_id', event.id),
    ])
    const firstErr = [judges, criteria, projects].find(r => r.error)?.error
    if (firstErr) { setError(jdError(firstErr)); setLoading(false); return }
    const judgeIds = (judges.data || []).map(j => j.id)
    const criteriaCount = (criteria.data || []).length
    const eligible = (projects.data || []).filter(p => p.eligible !== false)
    const prog = {}
    if (judgeIds.length) {
      const { data: scores, error: scErr } = await supabase.from('jd_scores').select('judge_id,project_id,criterion_id').in('judge_id', judgeIds)
      if (scErr) toast.err(jdError(scErr))
      else {
        const perJudge = {}
        for (const s of scores || []) { perJudge[s.judge_id] ??= {}; perJudge[s.judge_id][s.project_id] = (perJudge[s.judge_id][s.project_id] || 0) + 1 }
        for (const [jid, byProject] of Object.entries(perJudge)) prog[jid] = Object.values(byProject).filter(n => criteriaCount > 0 && n >= criteriaCount).length
      }
    }
    setRows(judges.data || []); setProgress(prog); setProjectsCount(eligible.length)
    setLoading(false)
  }, [supabase, event.id, toast])
  useEffect(() => { load() }, [load])

  async function create(e) {
    e.preventDefault()
    const n = name.trim(), d = Number(days)
    if (!n) { setFormError('اكتب اسم المحكّم'); return }
    if (!Number.isInteger(d) || d < 1 || d > 90) { setFormError('مدة الصلاحية بين 1 و 90 يومًا'); return }
    setBusy(true); setFormError('')
    const { data, error: err } = await supabase.rpc('jd_create_judge', { p_event_id: event.id, p_name: n, p_days: d })
    setBusy(false)
    if (err) { setFormError(jdError(err)); return }
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.access_code) { setFormError('لم يرجع الخادم رمز الدخول — تحقق من الدالة jd_create_judge.'); return }
    setCreated({ ...row, name: n }); setAdding(false); setName('')
    load()
  }
  async function revoke(id) {
    setBusy(true)
    const { error: err } = await supabase.from('jd_judges').update({ revoked: true }).eq('id', id)
    setBusy(false); setConfirmRevoke(null)
    if (err) { toast.err(jdError(err)); return }
    setRows(list => list.map(r => (r.id === id ? { ...r, revoked: true } : r)))
    toast.ok('أُلغي المحكّم — لن يستطيع الدخول بالرمز بعد الآن')
  }
  async function removeJudge() {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('jd_delete_judge', { p_event_id: event.id, p_judge_id: confirmDelete.id })
      if (error) throw error
      setConfirmDelete(null)
      toast.ok('حُذف المحكّم وتقييماته')
      await load()
    } catch (err) { toast.err(jdError(err)) }
    finally { setBusy(false) }
  }
  async function copy(text, label) {
    const ok = await copyText(text)
    ok ? toast.ok(`تم نسخ ${label}`) : toast.err('تعذّر النسخ — انسخه يدويًا')
  }

  if (loading) return <Spinner label="جارٍ تحميل المحكّمين…" />
  if (error) return <ErrorBox onRetry={load}>{error}</ErrorBox>
  const now = Date.now()

  return (
    <div className="jd-stack" style={{ gap: 16 }}>
      <HelpBox title="كيف يدخل المحكّم؟">
        أنشئ محكّمًا بالاسم فيُولَّد له رمز دخول بصيغة XXXX-XXXX يظهر مرة واحدة فقط. أرسل له الرمز أو «رابط الدعوة» بقناة خاصة؛ يفتح الرابط من جواله ويبدأ التقييم. المحكّم يختار أي مشروع ويقيّمه، ولا يرى النتائج أو درجات المحكّمين الآخرين.
      </HelpBox>
      <div className="jd-row jd-row-between">
        <p className="jd-muted jd-small">{rows.length} محكّم · {projectsCount} مشروع مؤهل لكل محكّم</p>
        <button type="button" className="jd-btn jd-btn-primary" onClick={() => { setAdding(true); setFormError('') }}><Icon name="plus" size={15} />محكّم جديد</button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="users" title="لا يوجد محكّمون" text="أضف المحكّمين بالاسم وسيُولَّد لكل واحد رمز دخول خاص." action={<button type="button" className="jd-btn jd-btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />إضافة محكّم</button>} />
      ) : (
        <div className="jd-grid">
          {rows.map(r => {
            const expired = r.expires_at && new Date(r.expires_at).getTime() < now
            const done = progress[r.id] || 0
            const st = r.revoked ? { cls: 'jd-badge-red', label: 'مُلغى' } : expired ? { cls: 'jd-badge-amber', label: 'انتهت الصلاحية' } : r.last_login_at ? { cls: 'jd-badge-green', label: 'نشط' } : { cls: 'jd-badge-gray', label: 'لم يدخل بعد' }
            return (
              <div key={r.id} className={`jd-judge-card ${r.revoked ? 'is-revoked' : ''}`}>
                <div className="jd-judge-top">
                  <span className="av">{String(r.name || '؟').trim().slice(0, 1)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{r.name}</b><small>أُنشئ {fmtDateTime(r.created_at)}</small></div>
                  <Ring value={projectsCount ? done / projectsCount : 0} size={46} stroke={5} tone={projectsCount && done >= projectsCount ? 'green' : 'purple'} label="المشاريع المكتملة">{done}/{projectsCount}</Ring>
                </div>
                <div className="jd-row jd-row-between">
                  <Badge cls={st.cls}>{st.label}</Badge>
                  <div className="jd-row">
                    <button type="button" className="jd-btn jd-btn-danger jd-btn-sm" onClick={() => setConfirmDelete(r)} disabled={busy}><Icon name="trash" size={14} />حذف</button>
                    {!r.revoked && <button type="button" className="jd-btn jd-btn-danger jd-btn-sm" onClick={() => setConfirmRevoke(r)} disabled={busy}><Icon name="x" size={14} />إلغاء</button>}
                  </div>
                </div>
                <div className="jd-kv">
                  <span>آخر دخول</span><b>{fmtDateTime(r.last_login_at)}</b>
                  <span>الصلاحية حتى</span><b>{fmtDateTime(r.expires_at)}</b>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={adding} title="محكّم جديد" onClose={() => !busy && setAdding(false)}
        actions={<button type="submit" form="jd-judge-form" className="jd-btn jd-btn-primary" disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء وتوليد الرمز'}</button>}>
        <form id="jd-judge-form" onSubmit={create} className="jd-stack">
          <Field label="اسم المحكّم"><input className="jd-input" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="د. فلان الفلاني" /></Field>
          <Field label="صلاحية الرمز (أيام)" hint="بعدها لا يعمل الرمز. الافتراضي 14 يومًا."><input className="jd-input" type="number" min={1} max={90} value={days} onChange={e => setDays(e.target.value)} style={{ maxWidth: 140 }} /></Field>
          {formError && <Alert kind="error">{formError}</Alert>}
        </form>
      </Modal>

      <Modal open={Boolean(created)} title={`رمز دخول: ${created?.name || ''}`} onClose={() => setCreated(null)} closeLabel="تم — أغلق">
        <Alert kind="warn" icon="shield">هذا الرمز يظهر <b>مرة واحدة فقط</b> ولا يمكن استرجاعه لاحقًا. انسخه الآن وأرسله للمحكّم بقناة خاصة. إن ضاع، ألغِ المحكّم وأنشئ رمزًا جديدًا.</Alert>
        <div className="jd-code-box"><div className="code">{created?.access_code}</div></div>
        <div className="jd-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="jd-btn jd-btn-primary" onClick={() => copy(created.access_code, 'الرمز')}><Icon name="copy" size={15} />نسخ الرمز</button>
          <button type="button" className="jd-btn jd-btn-soft" onClick={() => copy(inviteLink(event.slug, created.access_code), 'رابط الدعوة')}><Icon name="link" size={15} />نسخ رابط الدعوة</button>
        </div>
        <div className="jd-copy-row"><input className="jd-input jd-mono" readOnly value={created ? inviteLink(event.slug, created.access_code) : ''} onFocus={e => e.target.select()} aria-label="رابط الدعوة" /></div>
      </Modal>
      <ConfirmDialog open={Boolean(confirmDelete)} title="حذف المحكّم نهائيًا؟" text={`سيُحذف «${confirmDelete?.name}» وجميع تقييماته من هذه الفعالية، وتتغير النتائج بناءً على ذلك. تبقى بيانات المشاريع. لا يمكن التراجع عن الحذف.`} confirmLabel="حذف المحكّم وتقييماته" danger busy={busy} onConfirm={removeJudge} onCancel={() => !busy && setConfirmDelete(null)} />
      <ConfirmDialog open={Boolean(confirmRevoke)} title="إلغاء المحكّم؟" text={`لن يستطيع «${confirmRevoke?.name}» الدخول بالرمز بعد الآن. تقييماته المحفوظة تبقى.`} confirmLabel="إلغاء المحكّم" danger busy={busy} onConfirm={() => revoke(confirmRevoke.id)} onCancel={() => setConfirmRevoke(null)} />
    </div>
  )
}
