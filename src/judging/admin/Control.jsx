import { useState } from 'react'
import { Toggle, ConfirmDialog, Alert, Icon, HelpBox } from '../components/ui'
import { jdError, downloadCSV, fmtDateTime } from '../lib'
import { loadTeamReport, teamReportCSV, fetchAllRows } from '../reports'
import { csvCell } from '../../lib/security'

/* التحكم: مفتاحان كبيران + تصدير CSV */
export default function Control({ supabase, event, patchEvent, toast }) {
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  async function applyToggle() {
    if (!confirm) return
    setBusy(true)
    const { error } = await supabase.from('jd_events').update({ [confirm.key]: confirm.value }).eq('id', event.id)
    setBusy(false)
    if (error) { toast.err(jdError(error)); setConfirm(null); return }
    patchEvent(event.id, { [confirm.key]: confirm.value })
    toast.ok(confirm.key === 'judging_open' ? (confirm.value ? 'فُتح التحكيم' : 'أُغلق التحكيم') : (confirm.value ? 'نُشرت النتائج' : 'أُلغي نشر النتائج'))
    setConfirm(null)
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const [judges, projects, criteria] = await Promise.all([
        fetchAllRows(() => supabase.from('jd_judges').select('id,name').eq('event_id', event.id).order('id')),
        fetchAllRows(() => supabase.from('jd_projects').select('id,team_name,title,stage,eligible').eq('event_id', event.id).order('id')),
        fetchAllRows(() => supabase.from('jd_criteria').select('id,name,sort_order').eq('event_id', event.id).order('sort_order').order('id')),
      ])
      const projectIds = projects.map(p => p.id)
      let scores = []
      for (let offset = 0; offset < projectIds.length; offset += 100) {
        scores.push(...await fetchAllRows(() => supabase.from('jd_scores')
          .select('judge_id,project_id,criterion_id,score,note,updated_at')
          .in('project_id', projectIds.slice(offset, offset + 100))
          .order('judge_id').order('project_id').order('criterion_id')))
      }
      const J = Object.fromEntries(judges.map(j => [j.id, j]))
      const P = Object.fromEntries(projects.map(p => [p.id, p]))
      const C = Object.fromEntries(criteria.map(c => [c.id, c]))
      const lines = [['المحكّم', 'الفريق', 'المشروع', 'المرحلة', 'مؤهل', 'المعيار', 'النجوم (1-5)', 'الملاحظة', 'آخر تحديث'].map(csvCell).join(',')]
      scores
        .sort((a, b) => (J[a.judge_id]?.name || '').localeCompare(J[b.judge_id]?.name || '') || (P[a.project_id]?.team_name || '').localeCompare(P[b.project_id]?.team_name || '') || ((C[a.criterion_id]?.sort_order || 0) - (C[b.criterion_id]?.sort_order || 0)))
        .forEach(s => lines.push([J[s.judge_id]?.name || s.judge_id, P[s.project_id]?.team_name || s.project_id, P[s.project_id]?.title || '', P[s.project_id]?.stage || '', P[s.project_id]?.eligible === false ? 'لا' : 'نعم', C[s.criterion_id]?.name || s.criterion_id, s.score, s.note || '', fmtDateTime(s.updated_at)].map(csvCell).join(',')))
      downloadCSV(`judging-${event.slug}-${new Date().toISOString().slice(0, 10)}.csv`, lines)
      toast.ok(`صُدّر ${scores.length} تقييمًا`)
    } catch (err) {
      toast.err(jdError(err))
    } finally {
      setExporting(false)
    }
  }

  async function exportTeams() {
    setExporting(true)
    try {
      const { rows, criteria } = await loadTeamReport(supabase, event)
      downloadCSV(`team-results-${event.slug}.csv`, teamReportCSV(rows, criteria))
      toast.ok(`صُدّرت درجات ${rows.length} فريقًا`)
    } catch (err) { toast.err(jdError(err)) }
    finally { setExporting(false) }
  }

  async function resetScores() {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('jd_reset_scores', { p_event_id: event.id })
      if (error) throw error
      patchEvent(event.id, { judging_open: false, results_published: false, reveal_step: 0 })
      setConfirmReset(false)
      toast.ok('حُذفت التقييمات القديمة وبقيت المشاريع والمحكّمون والمعايير')
    } catch (err) { toast.err(jdError(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="jd-stack" style={{ gap: 16 }}>
      <HelpBox title="ترتيب يوم الحفل">
        افتح التحكيم عند بدء العروض ← يقيّم المحكّمون ← أغلق التحكيم ← راجع «النتائج الحية» ← انشر النتائج ← تحكّم بخطوات الكشف من «جهاز الكشف».
      </HelpBox>
      <div className="jd-switch jd-switch-lg">
        <div className="txt"><b><Icon name={event.judging_open ? 'unlock' : 'lock'} size={18} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />التحكيم {event.judging_open ? 'مفتوح' : 'مغلق'}</b><span>قبل الفتح يرى المحكّمون «التحكيم لم يبدأ بعد» ولا تظهر لهم المشاريع. عند الفتح يستطيعون حفظ درجاتهم وتعديلها، وعند الإغلاق بعد التقييم يرون «انتهى التحكيم، شكرًا لك».</span></div>
        <Toggle checked={Boolean(event.judging_open)} label="التحكيم مفتوح" disabled={busy} onChange={v => setConfirm({ key: 'judging_open', value: v })} />
      </div>
      <div className="jd-switch jd-switch-lg">
        <div className="txt"><b><Icon name="trophy" size={18} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />النتائج {event.results_published ? 'منشورة' : 'غير منشورة'}</b><span>عند النشر تصبح صفحة النتائج متاحة للعامة وتُفعَّل خطوات الكشف على المسرح. قبل النشر تعرض «لم تُعلن النتائج بعد».</span></div>
        <Toggle checked={Boolean(event.results_published)} label="النتائج منشورة" disabled={busy} onChange={v => setConfirm({ key: 'results_published', value: v })} />
      </div>
      {event.judging_open && event.results_published && <Alert kind="warn">التحكيم مفتوح والنتائج منشورة في الوقت نفسه — أي تعديل من محكّم سيغيّر الترتيب المعلن.</Alert>}
      <div className="jd-panel">
        <div className="jd-panel-head">
          <div><h2 className="jd-h3">تنزيل درجات الفرق</h2><p className="jd-sub">ملف CSV يفتح في Excel: كل فريق، درجة كل معيار حسب وزنه، والدرجة النهائية من 100. يشمل الفرق التي لم تُقيّم.</p></div>
          <button type="button" className="jd-btn jd-btn-primary" onClick={exportTeams} disabled={exporting}>{exporting ? 'جارٍ التصدير…' : 'تنزيل درجات الفرق'}</button>
        </div>
      </div>
      <div className="jd-panel">
        <div className="jd-panel-head">
          <div><h2 className="jd-h3"><Icon name="list" size={18} />تصدير التقييمات</h2><p className="jd-sub">ملف CSV بكل النجوم: المحكّم، الفريق، المشروع، المعيار، النجوم، الملاحظة.</p></div>
          <button type="button" className="jd-btn jd-btn-soft" onClick={exportCSV} disabled={exporting}><Icon name="copy" size={15} />{exporting ? 'جارٍ التصدير…' : 'تصدير CSV'}</button>
        </div>
      </div>
      <div className="jd-panel">
        <div className="jd-panel-head">
          <div><h2 className="jd-h3">حذف التقييمات القديمة</h2><p className="jd-sub">مسح تقييمات الفعالية الحالية مع الاحتفاظ بجميع المشاريع والمحكّمين والمعايير. يُغلق التحكيم ويُلغى نشر النتائج.</p></div>
          <button type="button" className="jd-btn jd-btn-danger" disabled={busy} onClick={() => setConfirmReset(true)}><Icon name="trash" size={15} />حذف التقييمات</button>
        </div>
      </div>
      <ConfirmDialog open={confirmReset} title="حذف جميع تقييمات هذه الفعالية؟" text={`ستُحذف جميع درجات وملاحظات «${event.name}» نهائيًا. نزّل ملف التقييمات أولًا إن كنت تحتاج نسخة. تبقى المشاريع والمحكّمون والمعايير دون حذف.`} confirmLabel="حذف التقييمات نهائيًا" danger busy={busy} onConfirm={resetScores} onCancel={() => !busy && setConfirmReset(false)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.key === 'judging_open' ? (confirm?.value ? 'فتح التحكيم؟' : 'إغلاق التحكيم؟') : (confirm?.value ? 'نشر النتائج للعامة؟' : 'إلغاء نشر النتائج؟')}
        text={confirm?.key === 'judging_open'
          ? (confirm?.value ? 'سيتمكن المحكّمون من حفظ نجومهم فورًا.' : 'لن يستطيع المحكّمون تعديل أي تقييم، وسيرون شاشة الشكر.')
          : (confirm?.value ? 'ستظهر النتائج والترتيب الكامل لكل من يفتح صفحة النتائج.' : 'ستعود صفحة النتائج إلى «لم تُعلن النتائج بعد».')}
        confirmLabel={confirm?.value ? 'تأكيد' : 'تأكيد الإيقاف'}
        danger={confirm?.key === 'results_published' && confirm?.value}
        busy={busy}
        onConfirm={applyToggle}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
