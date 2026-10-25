import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge } from '../components/ui'
import { REVEAL_STEPS, MAX_REVEAL_STEP, jdError } from '../lib'

export default function Remote({ supabase, event, patchEvent, toast }) {
  const [busy, setBusy] = useState(false)
  const current = Number(event.reveal_step || 0)

  async function go(step) {
    const s = Math.max(0, Math.min(MAX_REVEAL_STEP, step))
    if (s === current || busy) return
    setBusy(true)
    const { error } = await supabase.from('jd_events').update({ reveal_step: s }).eq('id', event.id)
    setBusy(false)
    if (error) { toast.err(jdError(error)); return }
    patchEvent(event.id, { reveal_step: s })
  }

  const now = REVEAL_STEPS.find(s => s.step === current)
  return (
    <div className="jd-remote">
      {!event.results_published && <Alert kind="warn">النتائج غير منشورة — صفحة المسرح ستعرض «لم تُعلن النتائج بعد» للجمهور حتى تنشرها من تبويب «التحكم والترتيب».</Alert>}
      <div className="jd-remote-now">
        <div>
          <span className="jd-kicker" style={{ fontSize: 11 }}>CURRENT STEP</span>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 4 }}>{now?.title}</div>
          <div className="jd-small jd-dim">{now?.hint}</div>
        </div>
        <b>{current}</b>
      </div>
      <div className="jd-remote-nav">
        <button type="button" className="jd-btn jd-btn-ghost jd-btn-lg" onClick={() => go(current - 1)} disabled={busy || current <= 0}>→ السابق</button>
        <button type="button" className="jd-btn jd-btn-primary jd-btn-lg" onClick={() => go(current + 1)} disabled={busy || current >= MAX_REVEAL_STEP}>التالي ←</button>
      </div>
      <div className="jd-remote-steps">
        {REVEAL_STEPS.filter(s => s.step > 0).map(s => (
          <button key={s.step} type="button" className="jd-remote-btn" aria-current={current === s.step ? 'step' : undefined} onClick={() => go(s.step)} disabled={busy}>
            <b>STEP {s.step}</b>
            <span>{s.title}</span>
            <small>{s.hint}</small>
          </button>
        ))}
      </div>
      <div className="jd-row jd-row-between">
        <button type="button" className="jd-btn jd-btn-danger" onClick={() => go(0)} disabled={busy || current === 0}>إعادة (الخطوة 0)</button>
        <div className="jd-row">
          <Badge cls={event.results_published ? 'jd-badge-green' : 'jd-badge-gray'}>{event.results_published ? 'النتائج منشورة' : 'غير منشورة'}</Badge>
          <Link to={`/judge/${event.slug}/results`} target="_blank" rel="noopener noreferrer" className="jd-btn jd-btn-soft">فتح صفحة المسرح ↗</Link>
        </div>
      </div>
      <p className="jd-small jd-dim">افتح صفحة المسرح على شاشة العرض (ملء الشاشة)، وتحكّم بالخطوات من هذا الجوال — التغيير يصل مباشرة عبر Realtime.</p>
    </div>
  )
}
