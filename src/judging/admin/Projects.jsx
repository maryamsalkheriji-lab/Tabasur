import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner, ErrorBox, EmptyState, Modal, Field, StageBadge, Badge, ConfirmDialog, HelpBox, Icon, Alert } from '../components/ui'
import { STAGE_OPTIONS, STAGES, TRACKS, jdError, DECK_TYPES, MAX_DECK_BYTES, deckName, fmtDateTime, projectMeta } from '../lib'
import { toSafeHttpUrl } from '../../lib/security'

const EMPTY = { team_name: '', title: '', track: '', team_size: '', description: '', demo_url: '', stage: 'prototype', eligible: true, sort_order: '' }
const BUCKET = 'jd-decks'

export default function Projects({ supabase, event, toast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [working, setWorking] = useState({})   // project_id → 'upload' | 'analyze' | 'adopt'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase.from('jd_projects').select('*').eq('event_id', event.id).order('sort_order', { ascending: true })
    if (err) setError(jdError(err)); else setRows(data || [])
    setLoading(false)
  }, [supabase, event.id])
  useEffect(() => { load() }, [load])

  const patch = (id, p) => setRows(list => list.map(r => (r.id === id ? { ...r, ...p } : r)))
  const setWork = (id, v) => setWorking(w => ({ ...w, [id]: v }))

  function open(row) {
    setEditing(row || 'new')
    setForm(row ? { team_name: row.team_name || '', title: row.title || '', track: row.track || '', team_size: row.team_size ?? '', description: row.description || '', demo_url: row.demo_url || '', stage: row.stage || 'prototype', eligible: row.eligible !== false, sort_order: row.sort_order ?? '' }
      : { ...EMPTY, sort_order: rows.length ? Math.max(...rows.map(r => r.sort_order || 0)) + 1 : 1 })
    setFormError('')
  }
  async function save(e) {
    e.preventDefault()
    const team_name = form.team_name.trim(), title = form.title.trim()
    if (!team_name) { setFormError('اسم المشروع/الفريق مطلوب'); return }
    const track = form.track.trim()
    const team_size = form.team_size === '' ? null : Number(form.team_size)
    if (team_size !== null && (!Number.isInteger(team_size) || team_size < 1 || team_size > 50)) { setFormError('عدد أعضاء الفريق رقم صحيح بين 1 و 50'); return }
    const demo = form.demo_url.trim()
    if (demo && !toSafeHttpUrl(demo)) { setFormError('رابط التجربة يجب أن يبدأ بـ http أو https'); return }
    const sort_order = form.sort_order === '' ? 0 : Number(form.sort_order)
    if (!Number.isInteger(sort_order)) { setFormError('الترتيب رقم صحيح'); return }
    setBusy(true); setFormError('')
    const payload = { event_id: event.id, team_name, title: title || null, track: track || null, team_size, description: form.description.trim() || null, demo_url: demo || null, stage: form.stage, eligible: Boolean(form.eligible), sort_order }
    const q = editing === 'new' ? supabase.from('jd_projects').insert(payload).select().single() : supabase.from('jd_projects').update(payload).eq('id', editing.id).select().single()
    const { data, error: err } = await q
    setBusy(false)
    if (err) { setFormError(jdError(err)); return }
    setRows(list => (editing === 'new' ? [...list, data] : list.map(r => (r.id === data.id ? data : r))).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
    toast.ok(editing === 'new' ? 'أُضيف المشروع' : 'تم حفظ المشروع')
    setEditing(null)
  }
  async function remove(id) {
    setBusy(true)
    const { error: err } = await supabase.from('jd_projects').delete().eq('id', id)
    setBusy(false); setConfirmDel(null)
    if (err) { toast.err(jdError(err)); return }
    setRows(list => list.filter(r => r.id !== id))
    toast.ok('حُذف المشروع')
  }

  /* رفع العرض (PDF/PPTX ≤ 20MB) إلى bucket خاص ثم حفظ المسار */
  async function uploadDeck(project, file) {
    if (!file) return
    const kind = DECK_TYPES[file.type] || (file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : file.name.toLowerCase().endsWith('.pptx') ? 'pptx' : null)
    if (!kind) { toast.err('الملف يجب أن يكون PDF أو PPTX'); return }
    if (file.size > MAX_DECK_BYTES) { toast.err('حجم الملف يتجاوز 20MB'); return }
    setWork(project.id, 'upload')
    try {
      const safeName = file.name.replace(/[^\w.\-؀-ۿ]+/g, '_').slice(-80)
      const path = `${event.id}/${project.id}/${Date.now()}-${safeName}`
      const contentType = kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: false })
      if (upErr) throw upErr
      const { data, error: dbErr } = await supabase.from('jd_projects').update({ deck_path: path }).eq('id', project.id).select().single()
      if (dbErr) throw dbErr
      patch(project.id, data)
      toast.ok('رُفع العرض — يمكنك الآن تحليله')
    } catch (err) {
      toast.err(jdError(err))
    } finally {
      setWork(project.id, '')
    }
  }

  /* استدعاء دالة التحليل على Vercel بجلسة الأدمن */
  async function analyze(project) {
    setWork(project.id, 'analyze')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا')
      const res = await fetch('/api/analyze-project', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ project_id: project.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.code || `HTTP ${res.status}`)
      patch(project.id, { ai_analysis: data.analysis, ai_stage: data.analysis?.stage, analyzed_at: data.analysis?.analyzed_at })
      toast.ok('اكتمل التحليل')
    } catch (err) {
      toast.err(jdError(err))
    } finally {
      setWork(project.id, '')
    }
  }

  /* اعتماد المرحلة: ai_stage → stage و has_working_product → eligible */
  async function adopt(project) {
    const a = project.ai_analysis
    if (!a?.stage) return
    setWork(project.id, 'adopt')
    const { data, error: err } = await supabase.from('jd_projects').update({ stage: a.stage, eligible: Boolean(a.has_working_product) }).eq('id', project.id).select().single()
    setWork(project.id, '')
    if (err) { toast.err(jdError(err)); return }
    patch(project.id, data)
    toast.ok(`اعتُمدت المرحلة: ${STAGES[a.stage]?.label || a.stage}${a.has_working_product ? '' : ' — المشروع غير مؤهل'}`)
  }

  if (loading) return <Spinner label="جارٍ تحميل المشاريع…" />
  if (error) return <ErrorBox onRetry={load}>{error}</ErrorBox>

  return (
    <div className="jd-stack" style={{ gap: 16 }}>
      <HelpBox title="المشاريع والتحليل">
        أضف مشروع كل فريق (الاسم والمسار وعدد الأعضاء هي ما يراه المحكّم). ارفع عرضه (PDF أو PPTX حتى 20MB) ثم اضغط «تحليل» ليخبرك الذكاء الاصطناعي بمرحلة المشروع وهل يملك منتجًا يعمل؛ «اعتماد المرحلة» ينسخ النتيجة إلى المرحلة والأهلية. التحليل مساعد لك فقط: لا يراه المحكّمون ولا يؤثر على الدرجات. المشاريع غير المؤهلة لا تظهر للمحكّمين ولا تدخل الترتيب.
      </HelpBox>
      <div className="jd-row jd-row-between">
        <p className="jd-muted jd-small">{rows.length} مشروع · المؤهل منها {rows.filter(r => r.eligible !== false).length}</p>
        <button type="button" className="jd-btn jd-btn-primary" onClick={() => open(null)}><Icon name="plus" size={15} />مشروع</button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="layers" title="لا توجد مشاريع" text="أضف مشاريع الفرق المشاركة ليقيّمها المحكّمون." action={<button type="button" className="jd-btn jd-btn-primary" onClick={() => open(null)}><Icon name="plus" size={16} />إضافة مشروع</button>} />
      ) : (
        <div className="jd-stack">
          {rows.map((r, i) => <ProjectCard key={r.id} r={r} i={i} work={working[r.id]} onEdit={() => open(r)} onDelete={() => setConfirmDel(r)} onUpload={(f) => uploadDeck(r, f)} onAnalyze={() => analyze(r)} onAdopt={() => adopt(r)} />)}
        </div>
      )}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'مشروع جديد' : 'تعديل المشروع'} onClose={() => !busy && setEditing(null)} wide
        actions={<button type="submit" form="jd-project-form" className="jd-btn jd-btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>}>
        <form id="jd-project-form" onSubmit={save} className="jd-form-row">
          <Field label="اسم المشروع / الفريق (كما يراه المحكّم)"><input className="jd-input" value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} autoFocus /></Field>
          <Field label="وصف قصير للحل (للأدمن والنتائج)"><input className="jd-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="المسار (يظهر للمحكّم)">
            <input className="jd-input" list="jd-tracks" value={form.track} onChange={e => setForm(f => ({ ...f, track: e.target.value }))} placeholder="الرياضة / السياحة / الزراعة" />
            <datalist id="jd-tracks">{TRACKS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="عدد أعضاء الفريق (يظهر للمحكّم)"><input className="jd-input" type="number" min={1} max={50} value={form.team_size} onChange={e => setForm(f => ({ ...f, team_size: e.target.value }))} style={{ maxWidth: 140 }} /></Field>
          <Field label="وصف قصير (للأدمن والتحليل — لا يظهر للمحكّم)" className="span2"><textarea className="jd-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="رابط التجربة (اختياري)" hint="http أو https فقط"><input className="jd-input" dir="ltr" type="url" value={form.demo_url} onChange={e => setForm(f => ({ ...f, demo_url: e.target.value }))} placeholder="https://" /></Field>
          <Field label="المرحلة"><select className="jd-select" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>{STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="الترتيب"><input className="jd-input" type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} style={{ maxWidth: 140 }} /></Field>
          <Field label="الأهلية"><label className="jd-check"><input type="checkbox" checked={form.eligible} onChange={e => setForm(f => ({ ...f, eligible: e.target.checked }))} /> مؤهل (يملك منتجًا يعمل — يظهر للمحكّمين ويدخل الترتيب)</label></Field>
          {formError && <div className="jd-alert jd-alert-error span2">{formError}</div>}
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(confirmDel)} title="حذف المشروع؟" text={`سيُحذف مشروع «${confirmDel?.title}» وكل تقييماته نهائيًا.`} confirmLabel="حذف" danger busy={busy} onConfirm={() => remove(confirmDel.id)} onCancel={() => setConfirmDel(null)} />
    </div>
  )
}

function ProjectCard({ r, i, work, onEdit, onDelete, onUpload, onAnalyze, onAdopt }) {
  const fileRef = useRef(null)
  const demo = toSafeHttpUrl(r.demo_url)
  const a = r.ai_analysis
  const aiStage = a?.stage || r.ai_stage
  return (
    <article className="jd-card" style={r.eligible === false ? { opacity: .75 } : undefined}>
      <div className="jd-row jd-row-between">
        <span className="jd-row" style={{ gap: 6 }}><StageBadge stage={r.stage} />{r.eligible === false ? <Badge cls="jd-badge-red" icon="x">غير مؤهل</Badge> : <Badge cls="jd-badge-green" icon="check">مؤهل</Badge>}</span>
        <span className="jd-card-tag">{String(r.sort_order ?? i + 1).padStart(2, '0')}</span>
      </div>
      <div>
        <h3>{r.team_name}</h3>
        <span className="jd-muted jd-small" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><Icon name="users" size={14} />{projectMeta(r) || 'بدون مسار/عدد أعضاء'}</span>
        {r.title && <p style={{ marginTop: 6, color: 'var(--jd-text-3)' }}>{r.title}</p>}
        {r.description && <p style={{ marginTop: 6 }}>{r.description}</p>}
      </div>
      <div className="jd-row" style={{ gap: 8 }}>
        <label className="jd-upload jd-btn jd-btn-soft jd-btn-sm" style={{ cursor: work ? 'wait' : 'pointer' }}>
          <Icon name="send" size={14} />{work === 'upload' ? 'جارٍ الرفع…' : r.deck_path ? 'استبدال العرض' : 'رفع العرض (PDF/PPTX)'}
          <input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={Boolean(work)} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; onUpload(f) }} />
        </label>
        {r.deck_path && <span className="jd-deck-chip"><Icon name="note" size={13} /><span>{deckName(r.deck_path)}</span></span>}
        {r.deck_path && <button type="button" className="jd-btn jd-btn-primary jd-btn-sm" onClick={onAnalyze} disabled={Boolean(work)}><Icon name="spark" size={14} />{work === 'analyze' ? 'جارٍ التحليل…' : a ? 'إعادة التحليل' : 'تحليل'}</button>}
        {demo && <a href={demo} target="_blank" rel="noopener noreferrer" className="jd-link jd-small"><Icon name="external" size={13} />التجربة</a>}
      </div>
      {work === 'analyze' && <Alert kind="info">يقرأ الذكاء الاصطناعي العرض الآن — قد يستغرق حتى دقيقة.</Alert>}
      {a && (
        <div className="jd-ai">
          <div className="jd-ai-head">
            <b><Icon name="spark" size={15} />تحليل العرض</b>
            <span className="jd-row" style={{ gap: 6 }}>
              <Badge cls={STAGES[aiStage]?.badge || 'jd-badge-gray'}>المرحلة المقترحة: {STAGES[aiStage]?.label || aiStage}</Badge>
              <Badge cls={a.has_working_product ? 'jd-badge-green' : 'jd-badge-red'} icon={a.has_working_product ? 'check' : 'x'}>{a.has_working_product ? 'يوجد منتج يعمل' : 'لا يوجد منتج يعمل'}</Badge>
            </span>
          </div>
          {a.stage_reason && <p>{a.stage_reason}</p>}
          <div className="jd-ai-grid">
            {a.problem_clarity && <div className="jd-ai-col"><h5>المشكلة</h5><p>{a.problem_clarity}</p></div>}
            {a.ai_usage && <div className="jd-ai-col"><h5>الذكاء الاصطناعي</h5><p>{a.ai_usage}</p></div>}
          </div>
          <div className="jd-ai-grid">
            {a.strengths?.length > 0 && <div className="jd-ai-col"><h5>نقاط القوة</h5><ul>{a.strengths.map((t, k) => <li key={k}>{t}</li>)}</ul></div>}
            {a.gaps?.length > 0 && <div className="jd-ai-col gaps"><h5>الفجوات</h5><ul>{a.gaps.map((t, k) => <li key={k}>{t}</li>)}</ul></div>}
            {a.questions_for_judges?.length > 0 && <div className="jd-ai-col q"><h5>أسئلة مقترحة للمحكّمين</h5><ul>{a.questions_for_judges.map((t, k) => <li key={k}>{t}</li>)}</ul></div>}
          </div>
          <div className="jd-ai-foot">
            <span>{a.model ? `${a.model} · ` : ''}{fmtDateTime(r.analyzed_at || a.analyzed_at)}</span>
            <button type="button" className="jd-btn jd-btn-green jd-btn-sm" onClick={onAdopt} disabled={Boolean(work) || (r.stage === aiStage && (r.eligible !== false) === Boolean(a.has_working_product))}><Icon name="check" size={14} />{work === 'adopt' ? '…' : 'اعتماد المرحلة والأهلية'}</button>
          </div>
        </div>
      )}
      <div className="jd-card-foot">
        <span className="jd-dim jd-small">{r.deck_path ? 'العرض مرفوع' : 'لم يُرفع عرض بعد'}</span>
        <div className="jd-row" style={{ gap: 6 }}>
          <button type="button" className="jd-btn jd-btn-soft jd-btn-sm" onClick={onEdit}><Icon name="edit" size={14} />تعديل</button>
          <button type="button" className="jd-btn jd-btn-danger jd-btn-sm" onClick={onDelete}><Icon name="trash" size={14} /></button>
        </div>
      </div>
    </article>
  )
}
