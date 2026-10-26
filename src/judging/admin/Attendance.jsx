import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, EmptyState, ErrorBox, Icon, Spinner } from '../components/ui'
import { copyText, downloadCSV, fmtDateTime } from '../lib'
import { fetchAllRows } from '../reports'
import { csvCell } from '../../lib/security'
import { RSVP_LABELS, rsvpPath } from '../../lib/rsvp'

export default function Attendance({ supabase, event, toast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const active = useRef(true)
  const inFlight = useRef(false)
  const link = `${window.location.origin}${rsvpPath(event.slug)}`

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      const data = await fetchAllRows(() => supabase.from('jd_rsvps')
        .select('id,full_name,status,created_at,updated_at').eq('event_id', event.id)
        .order('created_at', { ascending: false }).order('id'))
      if (active.current) { setRows(data); setError('') }
    } catch {
      if (active.current) setError('تعذّر تحميل ردود الحضور. حاول التحديث مرة أخرى.')
    } finally {
      inFlight.current = false
      if (active.current) { setLoading(false); setRefreshing(false) }
    }
  }, [supabase, event.id])

  useEffect(() => {
    active.current = true
    load()
    const refresh = () => { if (!document.hidden) load() }
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active.current = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const attending = rows.filter(row => row.status === 'attending').length
  const visible = useMemo(() => rows.filter(row => (filter === 'all' || row.status === filter)
    && row.full_name.toLocaleLowerCase('ar').includes(search.trim().toLocaleLowerCase('ar'))), [rows, filter, search])

  async function copyLink() {
    if (await copyText(link)) toast.ok('تم نسخ رابط تأكيد الحضور')
    else toast.err('تعذّر النسخ. يمكنك تحديد الرابط ونسخه يدويًا.')
  }

  function exportCSV() {
    const lines = [['الاسم', 'الرد', 'تاريخ الرد', 'آخر تحديث'].map(csvCell).join(','), ...visible.map(row =>
      [row.full_name, RSVP_LABELS[row.status], fmtDateTime(row.created_at), fmtDateTime(row.updated_at)].map(csvCell).join(','))]
    downloadCSV(`attendance-${event.slug}.csv`, lines)
  }

  return (
    <div className="jd-stack">
      <div className="jd-panel jd-stack">
        <div className="jd-row jd-row-between">
          <div><h2 className="jd-h3">تأكيد الحضور</h2><p className="jd-sub">أرفق هذا الرابط مع الدعوات لحضور {event.name}.</p></div>
          <a className="jd-btn jd-btn-soft" href={link} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />فتح صفحة الدعوة</a>
        </div>
        <div className="jd-row">
          <input className="jd-input jd-mono" aria-label="رابط تأكيد الحضور" readOnly dir="ltr" value={link} onFocus={e => e.target.select()} style={{ flex: '1 1 230px', minWidth: 0 }} />
          <button className="jd-btn jd-btn-primary" onClick={copyLink}><Icon name="copy" size={16} />نسخ الرابط</button>
        </div>
      </div>
      {loading ? <Spinner label="جارٍ تحميل ردود الحضور…" /> : (
        <>
          {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
          <div className="jd-row" aria-label="إحصائيات الحضور">
            <Badge cls="jd-badge-purple">إجمالي الردود: {rows.length}</Badge>
            <Badge cls="jd-badge-green">تأكيد الحضور: {attending}</Badge>
            <Badge cls="jd-badge-gray">الاعتذارات: {rows.length - attending}</Badge>
          </div>
          <div className="jd-toolbar">
            <div className="jd-row">
              <input className="jd-input" type="search" aria-label="بحث بالاسم" placeholder="بحث بالاسم…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="jd-select" aria-label="تصفية الردود" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">كل الردود</option><option value="attending">تأكيد الحضور</option><option value="declined">الاعتذارات</option>
              </select>
            </div>
            <div className="jd-row">
              <button className="jd-btn jd-btn-soft" onClick={load} disabled={refreshing}><Icon name="refresh" size={16} />{refreshing ? 'جارٍ التحديث…' : 'تحديث'}</button>
              <button className="jd-btn jd-btn-soft" onClick={exportCSV} disabled={!visible.length || Boolean(error)}><Icon name="download" size={16} />تصدير CSV</button>
            </div>
          </div>
          {!error && rows.length === 0 ? <EmptyState icon="users" title="لم تصل ردود بعد" text="ستظهر الأسماء وتأكيدات الحضور والاعتذارات هنا عند الرد على الدعوة." /> : visible.length ? (
            <div className="jd-table-wrap"><table className="jd-table">
              <thead><tr><th>الاسم</th><th>الرد</th><th>تاريخ الرد</th><th>آخر تحديث</th></tr></thead>
              <tbody>{visible.map(row => <tr key={row.id}>
                <td style={{ overflowWrap: 'anywhere', maxWidth: 300 }}>{row.full_name}</td>
                <td><Badge cls={row.status === 'attending' ? 'jd-badge-green' : 'jd-badge-gray'}>{RSVP_LABELS[row.status]}</Badge></td>
                <td>{fmtDateTime(row.created_at)}</td><td>{fmtDateTime(row.updated_at)}</td>
              </tr>)}</tbody>
            </table></div>
          ) : !error && <Alert kind="info">لا توجد ردود تطابق البحث.</Alert>}
          <p className="jd-small jd-muted">تتحدّث الردود تلقائيًا كل ١٥ ثانية أثناء فتح هذه الصفحة.</p>
        </>
      )}
    </div>
  )
}
