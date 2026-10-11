import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, Modal, Badge, EmptyState, Icon, HelpBox, Spinner, ErrorBox, ConfirmDialog } from '../components/ui'
import { eventStatus, isValidSlug, normalizeSlug, jdError, fmtDate, STANDARD_CRITERIA, judgeLoginLink } from '../lib'

const EMPTY = { name: '', slug: '', description: '', winners_count: 3 }

export default function Events({ supabase, events, event, reloadEvents, setEventId, toast }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function open(ev) {
    setEditing(ev || 'new')
    setForm(ev ? { name: ev.name || '', slug: ev.slug || '', description: ev.description || '', winners_count: ev.winners_count || 3 } : EMPTY)
    setError('')
  }
  async function save(e) {
    e.preventDefault()
    const name = form.name.trim(), slug = normalizeSlug(form.slug), winners = Number(form.winners_count)
    if (!name) { setError('اكتب اسم الفعالية'); return }
    if (!isValidSlug(slug)) { setError('المعرّف يجب أن يكون بحروف لاتينية صغيرة وأرقام وشرطات فقط، مثل ai-hackathon'); return }
    if (!Number.isInteger(winners) || winners < 1 || winners > 10) { setError('عدد الفائزين بين 1 و 10'); return }
    setBusy(true); setError('')
    const payload = { name, slug, description: form.description.trim() || null, winners_count: winners }
    const q = editing === 'new' ? supabase.from('jd_events').insert(payload).select().single() : supabase.from('jd_events').update(payload).eq('id', editing.id).select().single()
    const { data, error: err } = await q
    setBusy(false)
    if (err) { setError(jdError(err)); return }
    toast.ok(editing === 'new' ? 'أُنشئت الفعالية' : 'تم حفظ التعديلات')
    await reloadEvents(true)
    if (editing === 'new' && data?.id) setEventId(data.id)
    setEditing(null)
  }

  return (
    <div className="jd-stack" style={{ gap: 16 }}>
      <div className="jd-row jd-row-between">
        <p className="jd-muted jd-small">كل فعالية لها رابط للمحكّمين <span className="jd-mono">/judge/&lt;slug&gt;</span> وصفحة نتائج. اختر الفعالية النشطة من الأعلى لإدارة معاييرها ومشاريعها.</p>
        <button type="button" className="jd-btn jd-btn-primary" onClick={() => open(null)}><Icon name="plus" size={15} />فعالية جديدة</button>
      </div>
      {events.length === 0 ? (
        <EmptyState icon="flag" title="لا توجد فعاليات" text="أنشئ أول فعالية لبدء إعداد المعايير والمشاريع والمحكّمين." action={<button type="button" className="jd-btn jd-btn-primary" onClick={() => open(null)}>فعالية جديدة</button>} />
      ) : (
        <div className="jd-grid">
          {events.map(ev => {
            const st = eventStatus(ev)
            const active = event?.id === ev.id
            return (
              <article key={ev.id} className="jd-card" style={active ? { borderColor: 'var(--jd-accent-light)' } : undefined}>
                <div className="jd-row jd-row-between">
                  <Badge cls={st.cls} dot={st.live}>{st.label}</Badge>
                  <span className="jd-card-tag jd-mono">{ev.slug}</span>
                </div>
                <h3>{ev.name}</h3>
                {ev.description && <p>{ev.description}</p>}
                <div className="jd-row jd-small jd-dim"><span>الفائزون: {ev.winners_count || 3}</span><span>· خطوة الكشف: {ev.reveal_step || 0}</span><span>· {fmtDate(ev.created_at)}</span></div>
                <div className="jd-card-foot">
                  <div className="jd-row">
                    <button type="button" className="jd-btn jd-btn-soft jd-btn-sm" onClick={() => open(ev)}><Icon name="edit" size={14} />تعديل</button>
                    {!active && <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={() => setEventId(ev.id)}>تحديد كنشطة</button>}
                    {active && <Badge cls="jd-badge-purple">النشطة</Badge>}
                  </div>
                  <Link to={`/judge/${ev.slug}`} className="jd-link jd-small" target="_blank" rel="noopener noreferrer">صفحة المحكّمين ↗</Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {event && <CriteriaPanel key={event.id} supabase={supabase} event={event} toast={toast} />}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'فعالية جديدة' : 'تعديل الفعالية'} onClose={() => !busy && setEditing(null)}
        actions={<button type="submit" form="jd-event-form" className="jd-btn jd-btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>}>
        <form id="jd-event-form" onSubmit={save} className="jd-stack">
          <Field label="اسم الفعالية"><input className="jd-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="هاكاثون الذكاء الاصطناعي" autoFocus /></Field>
          <Field label="المعرّف في الرابط (slug)" hint={`حروف لاتينية صغيرة وأرقام وشرطات. رابط المحكّمين سيكون: ${judgeLoginLink(normalizeSlug(form.slug) || '…')}`}>
            <input className="jd-input" dir="ltr" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: normalizeSlug(e.target.value) }))} placeholder="ai-hackathon" />
          </Field>
          <Field label="الوصف (اختياري)"><textarea className="jd-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="عدد الفائزين" hint="الافتراضي 3. يُميّز الفائزون في جدول الترتيب، ومنصة التتويج تعرض المراكز الثلاثة الأولى."><input className="jd-input" type="number" min={1} max={10} value={form.winners_count} onChange={e => setForm(f => ({ ...f, winners_count: e.target.value }))} style={{ maxWidth: 140 }} /></Field>
          {error && <div className="jd-alert jd-alert-error">{error}</div>}
        </form>
      </Modal>
    </div>
  )
}

/* معايير الفعالية النشطة: استيراد المعايير القياسية الخمسة (وزن 20 لكل معيار) أو تعديلها */
function CriteriaPanel({ supabase, event, toast }) {
  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase.from('jd_criteria').select('*').eq('event_id', event.id).order('sort_order', { ascending: true })
    if (err) setError(jdError(err)); else { setRows(data || []); setDrafts({}) }
    setLoading(false)
  }, [supabase, event.id])
  useEffect(() => { load() }, [load])

  const value = (r, key) => drafts[r.id]?.[key] ?? (r[key] ?? '')
  const dirty = (r) => Boolean(drafts[r.id])
  const draft = (id, key, v) => setDrafts(d => ({ ...d, [id]: { ...(d[id] || {}), [key]: v } }))
  const total = Math.round(rows.reduce((a, r) => a + (Number(value(r, 'weight')) || 0), 0) * 100) / 100
  const isStandard = rows.length === STANDARD_CRITERIA.length && rows.every((r, i) => r.name === STANDARD_CRITERIA[i].name && Number(r.weight) === 20)

  async function importStandard() {
    setBusy('import')
    if (rows.length) {
      const { error: delErr } = await supabase.from('jd_criteria').delete().eq('event_id', event.id)
      if (delErr) { setBusy(''); setConfirm(null); toast.err(jdError(delErr)); return }
    }
    const { error: err } = await supabase.from('jd_criteria').insert(STANDARD_CRITERIA.map(c => ({ event_id: event.id, name: c.name, description: c.description, weight: c.weight, sort_order: c.sort_order })))
    setBusy(''); setConfirm(null)
    if (err) { toast.err(jdError(err)); return }
    toast.ok('تم استيراد المعايير القياسية الخمسة')
    load()
  }
  async function saveRow(r) {
    const d = drafts[r.id]; if (!d) return
    const name = String(d.name ?? r.name).trim(), weight = Number(d.weight ?? r.weight)
    if (!name) { toast.err('اسم المعيار مطلوب'); return }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) { toast.err('الوزن رقم بين 0 و 100'); return }
    setBusy(r.id)
    const { data, error: err } = await supabase.from('jd_criteria').update({ name, description: String(d.description ?? r.description ?? '').trim() || null, weight }).eq('id', r.id).select().single()
    setBusy('')
    if (err) { toast.err(jdError(err)); return }
    setRows(list => list.map(x => (x.id === r.id ? data : x)))
    setDrafts(dd => { const n = { ...dd }; delete n[r.id]; return n })
    toast.ok('تم الحفظ')
  }
  async function addRow() {
    setBusy('new')
    const sort_order = rows.length ? Math.max(...rows.map(r => r.sort_order || 0)) + 1 : 1
    const { data, error: err } = await supabase.from('jd_criteria').insert({ event_id: event.id, name: 'معيار جديد', description: null, weight: 0, sort_order }).select().single()
    setBusy('')
    if (err) { toast.err(jdError(err)); return }
    setRows(list => [...list, data])
  }
  async function deleteRow(id) {
    setBusy(id)
    const { error: err } = await supabase.from('jd_criteria').delete().eq('id', id)
    setBusy(''); setConfirm(null)
    if (err) { toast.err(jdError(err)); return }
    setRows(list => list.filter(r => r.id !== id))
    toast.ok('حُذف المعيار')
  }

  return (
    <div className="jd-panel">
      <div className="jd-panel-head">
        <div>
          <h2 className="jd-h3"><Icon name="list" size={18} />معايير التقييم — {event.name}</h2>
          <p className="jd-sub">المحكّم يرى اسم المعيار وجملته ويقيّم بالنجوم من 1 إلى 5. الأوزان متساوية (20 لكل معيار) ولا تُعرض للمحكّمين.</p>
        </div>
        <div className="jd-row">
          <button type="button" className="jd-btn jd-btn-soft" onClick={() => (rows.length ? setConfirm({ kind: 'import' }) : importStandard())} disabled={Boolean(busy) || isStandard}><Icon name="spark" size={15} />{isStandard ? 'المعايير القياسية مفعّلة' : 'استيراد المعايير القياسية'}</button>
          <button type="button" className="jd-btn jd-btn-ghost jd-btn-sm" onClick={addRow} disabled={Boolean(busy)}><Icon name="plus" size={14} />معيار</button>
        </div>
      </div>
      {loading ? <Spinner label="جارٍ تحميل المعايير…" plain /> : error ? <ErrorBox onRetry={load}>{error}</ErrorBox> : rows.length === 0 ? (
        <EmptyState icon="list" title="لا توجد معايير بعد" text="استورد المعايير القياسية الخمسة (هل يعمل فعلًا؟ … هل العرض مقنع؟) بضغطة واحدة." action={<button type="button" className="jd-btn jd-btn-primary" onClick={importStandard} disabled={Boolean(busy)}><Icon name="spark" size={16} />استيراد المعايير القياسية</button>} />
      ) : (
        <div className="jd-stack">
          {total !== 100 && <div className="jd-alert jd-alert-warn">مجموع الأوزان {total} وليس 100 — الدرجة النهائية من 100 تعتمد عليه. استورد المعايير القياسية أو اضبط الأوزان.</div>}
          {rows.map((r, i) => (
            <div key={r.id} className={`jd-crit-row ${dirty(r) ? 'is-dirty' : ''}`}>
              <span className="num">{i + 1}</span>
              <div>
                <div className="fields">
                  <Field label="اسم المعيار (سؤال قصير)"><input className="jd-input" value={value(r, 'name')} onChange={e => draft(r.id, 'name', e.target.value)} /></Field>
                  <Field label="الوزن"><input className="jd-input jd-mono" type="number" min={0} max={100} value={value(r, 'weight')} onChange={e => draft(r.id, 'weight', e.target.value)} /></Field>
                  <Field label="ما الذي يقيّمه المحكّم؟ (جملة واحدة تظهر له)" className="full"><input className="jd-input" value={value(r, 'description')} onChange={e => draft(r.id, 'description', e.target.value)} /></Field>
                </div>
                <div className="acts">
                  <button type="button" className="jd-btn jd-btn-green jd-btn-sm" onClick={() => saveRow(r)} disabled={!dirty(r) || busy === r.id}>{busy === r.id ? '…' : <><Icon name="check" size={14} />حفظ</>}</button>
                  <button type="button" className="jd-btn jd-btn-danger jd-btn-sm" onClick={() => setConfirm({ kind: 'delete', id: r.id })} disabled={Boolean(busy)}><Icon name="trash" size={14} />حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={confirm?.kind === 'import'} title="استبدال المعايير الحالية؟" text={`سيتم حذف ${rows.length} معيارًا موجودًا (وأي تقييمات مرتبطة بها) واستيراد المعايير القياسية الخمسة.`} confirmLabel="حذف واستيراد" danger busy={busy === 'import'} onConfirm={importStandard} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm?.kind === 'delete'} title="حذف المعيار؟" text="ستُحذف أيضًا أي نجوم سجّلها المحكّمون لهذا المعيار." confirmLabel="حذف" danger busy={Boolean(busy) && busy === confirm?.id} onConfirm={() => deleteRow(confirm.id)} onCancel={() => setConfirm(null)} />
    </div>
  )
}
