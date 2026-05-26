import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseActive } from '../lib/supabase'
import styles from './Admin.module.css'

/* ─── Helpers ─── */
const SPECIALTY_LABELS = {
  photo:'مصوّر فوتوغرافي', video:'مصوّر فيديو', content:'صانع محتوى',
  graphic:'مصمّم جرافيك', motion:'موشن ديزاينر', ai:'متخصّص AI',
  editor:'مونتير', other:'أخرى'
}
const AI_LABELS  = { yes:'نعم', sometimes:'أحياناً', no:'لا' }
const AI_COLORS  = { yes:'var(--green-600)', sometimes:'var(--gold-500)', no:'var(--coral-500)' }
const EXP_LABELS = { '0-1':'< سنة','1-3':'١–٣','3-5':'٣–٥','5-10':'٥–١٠','10+':'+١٠' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' })
}

function exportCSV(rows) {
  const headers = ['#','الاسم','البريد','الجوال','المدينة','التخصص','الخبرة','أدوات AI','رابط الأعمال','الملاحظات','تاريخ التسجيل']
  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`
  const lines = [
    headers.join(','),
    ...rows.map((r,i) => [
      i+1, esc(r.full_name), esc(r.email), esc(r.mobile), esc(r.city||''),
      esc(SPECIALTY_LABELS[r.specialty]||r.specialty),
      esc(EXP_LABELS[r.experience]||r.experience||''),
      esc(AI_LABELS[r.ai_experience]||r.ai_experience||''),
      esc(r.portfolio||''), esc(r.notes||''), esc(fmtDate(r.created_at)),
    ].join(','))
  ]
  const blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/csv;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tabasur-registrations-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className={styles.statCard} style={{'--accent': accent}}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statBody}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

/* ─── Bar chart ─── */
function BarChart({ data, colorVar }) {
  const max = Math.max(...data.map(d => d.v), 1)
  return (
    <div className={styles.barChart}>
      {data.map((d,i) => (
        <div key={i} className={styles.barItem}>
          <div className={styles.barLabelRow}>
            <span className={styles.barLabel}>{d.k}</span>
            <span className={styles.barCount}>{d.v}</span>
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{width:`${(d.v/max)*100}%`, background: colorVar||'var(--green-500)'}} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Donut chart ─── */
function DonutChart({ slices }) {
  const total = slices.reduce((s,d) => s+d.v, 0) || 1
  const r = 42, cx = 60, cy = 60, stroke = 16
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={140} height={140} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-alt)" strokeWidth={stroke}/>
      {slices.map((s,i) => {
        const dash = (s.v/total)*circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ-dash}`}
            strokeDashoffset={-offset}
            style={{transform:'rotate(-90deg)',transformOrigin:'60px 60px'}}
          />
        )
        offset += dash
        return el
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--ink-900)">{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="9" fill="var(--ink-500)">مسجّل</text>
    </svg>
  )
}

/* ─── No Supabase notice ─── */
function NoSupabaseNotice() {
  return (
    <div className={styles.noSupabase}>
      <div className={styles.noSupabaseIcon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16M4 12h16M4 17h10"/>
          <circle cx="19" cy="17" r="3" fill="var(--coral-100)" stroke="var(--coral-500)"/>
          <path d="M19 15.5v1.5M19 18.5v.5" stroke="var(--coral-600)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <h3>Supabase غير مربوط</h3>
      <p>لعرض بيانات المسجّلين، أضف بيانات Supabase في ملف <code>.env</code></p>
      <div className={styles.envBox}>
        <code>VITE_SUPABASE_URL=https://xxxx.supabase.co</code>
        <code>VITE_SUPABASE_ANON_KEY=eyJhbGc...</code>
      </div>
      <p className={styles.noSupabaseSub}>
        ثم تأكد من إضافة Policy تسمح بالقراءة في جدول <code>registrations</code>
      </p>
    </div>
  )
}

const PER_PAGE = 10

export default function Admin() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [filterSpec, setFilterSpec] = useState('')
  const [filterAI, setFilterAI] = useState('')
  const [sortKey, setSortKey]   = useState('created_at')
  const [sortDir, setSortDir]   = useState('desc')
  const [selected, setSelected] = useState(null)
  const [page, setPage]         = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    if (!isSupabaseActive) {
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* Filter + sort */
  const filtered = rows
    .filter(r => {
      const q = search.toLowerCase()
      const matchQ  = !q || [r.full_name, r.email, r.city].some(v => v?.toLowerCase().includes(q))
      const matchSp = !filterSpec || r.specialty === filterSpec
      const matchAI = !filterAI   || r.ai_experience === filterAI
      return matchQ && matchSp && matchAI
    })
    .sort((a,b) => {
      let va = a[sortKey]??'', vb = b[sortKey]??''
      if (sortKey === 'created_at') { va = new Date(va); vb = new Date(vb) }
      return sortDir === 'asc' ? (va<vb?-1:va>vb?1:0) : (va>vb?-1:va<vb?1:0)
    })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  function toggleSort(k) {
    if (sortKey === k) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('asc') }
    setPage(1)
  }

  /* Stats */
  const total   = rows.length
  const mdCount = rows.filter(r => r.city?.includes('المدينة')).length
  const aiYes   = rows.filter(r => r.ai_experience === 'yes').length
  const topSpec = Object.entries(
    rows.reduce((a,r) => { a[r.specialty]=(a[r.specialty]||0)+1; return a }, {})
  ).sort((a,b)=>b[1]-a[1])[0]

  const specDist = Object.entries(
    rows.reduce((a,r) => { a[r.specialty]=(a[r.specialty]||0)+1; return a }, {})
  ).map(([k,v])=>({k:SPECIALTY_LABELS[k]||k,v})).sort((a,b)=>b.v-a.v)

  const aiDist = [
    { k:'نعم',    v: rows.filter(r=>r.ai_experience==='yes').length,       color:'var(--green-500)' },
    { k:'أحياناً', v: rows.filter(r=>r.ai_experience==='sometimes').length, color:'var(--gold-500)'  },
    { k:'لا',     v: rows.filter(r=>r.ai_experience==='no').length,        color:'var(--coral-500)' },
  ]

  const cityDist = Object.entries(
    rows.reduce((a,r) => { const c=r.city||'غير محدد'; a[c]=(a[c]||0)+1; return a }, {})
  ).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,6)

  const last14 = Array.from({length:14},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-13+i)
    const key = d.toISOString().slice(0,10)
    return { k:d.toLocaleDateString('ar',{month:'short',day:'numeric'}), v:rows.filter(r=>r.created_at?.slice(0,10)===key).length }
  })
  const maxDay = Math.max(...last14.map(d=>d.v), 1)

  const SortArrow = ({k}) => (
    <span className={styles.sortIcon} style={{opacity:sortKey===k?1:0.3}}>
      {sortKey===k ? (sortDir==='asc'?'↑':'↓') : '↕'}
    </span>
  )

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <div className={styles.headerMark}>
            <img src="/assets/tabsur-mark.png" alt="" />
          </div>
          <div>
            <div className={styles.headerTitle}>لوحة إدارة تبصُّر</div>
            <div className={styles.headerSub}>ADMIN DASHBOARD · TABSUR CAMP</div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            تحديث
          </button>
          <button className={styles.exportBtn} onClick={() => exportCSV(filtered)} disabled={!isSupabaseActive || filtered.length===0}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تصدير Excel
          </button>
        </div>
      </header>

      <div className={styles.strip}>
        <span className={styles.g}/><span className={styles.c}/><span className={styles.m}/>
      </div>

      {/* Body */}
      <div className={styles.body}>

        {/* Supabase غير مربوط */}
        {!isSupabaseActive && <NoSupabaseNotice />}

        {/* خطأ في التحميل */}
        {error && (
          <div className={styles.errorBanner}>
            <strong>خطأ في تحميل البيانات:</strong> {error}
          </div>
        )}

        {/* Stats */}
        {isSupabaseActive && (
          <>
            <div className={styles.statsRow}>
              <StatCard label="إجمالي المسجّلين" value={loading ? '...' : total}
                sub={total > 0 ? `من ${cityDist.length} مدينة` : 'لا يوجد مسجّلين بعد'}
                accent="var(--green-600)"
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
              />
              <StatCard label="من المدينة المنورة" value={loading ? '...' : mdCount}
                sub={total ? `${Math.round(mdCount/total*100)}% من الإجمالي` : ''}
                accent="var(--mauve-600)"
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>}
              />
              <StatCard label="يستخدمون أدوات AI" value={loading ? '...' : aiYes}
                sub={total ? `${Math.round(aiYes/total*100)}% من المسجّلين` : ''}
                accent="var(--coral-500)"
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>}
              />
              <StatCard label="أعلى تخصّص" value={loading ? '...' : (topSpec ? SPECIALTY_LABELS[topSpec[0]]||topSpec[0] : '—')}
                sub={topSpec ? `${topSpec[1]} مسجّل` : ''}
                accent="var(--gold-500)"
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
              />
            </div>

            {total > 0 && (
              <div className={styles.chartsRow}>
                <div className={styles.chartCard}>
                  <span className={styles.chartEyebrow}>التخصصات</span>
                  <BarChart data={specDist} colorVar="var(--green-500)" />
                </div>
                <div className={`${styles.chartCard} ${styles.chartCardCenter}`}>
                  <span className={styles.chartEyebrow}>خبرة AI</span>
                  <DonutChart slices={aiDist} />
                  <div className={styles.donutLegend}>
                    {aiDist.map(s => (
                      <div key={s.k} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{background:s.color}}/>
                        <span>{s.k}</span>
                        <strong>{s.v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.chartCard}>
                  <span className={styles.chartEyebrow}>المدن</span>
                  <BarChart data={cityDist} colorVar="var(--mauve-500)" />
                </div>
                <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
                  <span className={styles.chartEyebrow}>التسجيلات — آخر ١٤ يوماً</span>
                  <div className={styles.timeline}>
                    {last14.map((d,i) => (
                      <div key={i} className={styles.timelineCol}>
                        <div className={styles.timelineBar}>
                          <div className={styles.timelineFill}
                            style={{height:`${(d.v/maxDay)*100}%`, background:d.v?'var(--green-500)':'var(--ink-200)'}}/>
                        </div>
                        <span className={styles.timelineLabel}>{d.k}</span>
                        {d.v > 0 && <span className={styles.timelineCount}>{d.v}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Filters + Table */}
            <div className={styles.tableCard}>
              <div className={styles.tableHead}>
                <div className={styles.tableTitle}>
                  <span className={styles.chartEyebrow}>سجلات التسجيل</span>
                  <span className={styles.tableCount}>{filtered.length} نتيجة</span>
                </div>
                <div className={styles.filters}>
                  <div className={styles.searchWrap}>
                    <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input className={styles.searchInput}
                      placeholder="ابحث بالاسم أو البريد أو المدينة..."
                      value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    />
                  </div>
                  <select className={styles.filterSelect} value={filterSpec} onChange={e => { setFilterSpec(e.target.value); setPage(1) }}>
                    <option value="">كل التخصصات</option>
                    {Object.entries(SPECIALTY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select className={styles.filterSelect} value={filterAI} onChange={e => { setFilterAI(e.target.value); setPage(1) }}>
                    <option value="">كل إجابات AI</option>
                    <option value="yes">نعم</option>
                    <option value="sometimes">أحياناً</option>
                    <option value="no">لا</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}/>
                  <span>جاري تحميل البيانات...</span>
                </div>
              ) : rows.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{color:'var(--ink-300)'}}>
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  <span>لا يوجد مسجّلون بعد</span>
                  <p>ستظهر بيانات المسجّلين هنا فور إرسالهم النموذج</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>لا توجد نتائج مطابقة</span>
                </div>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th onClick={()=>toggleSort('full_name')} className={styles.sortable}>الاسم <SortArrow k="full_name"/></th>
                          <th>البريد</th>
                          <th>الجوال</th>
                          <th onClick={()=>toggleSort('city')} className={styles.sortable}>المدينة <SortArrow k="city"/></th>
                          <th onClick={()=>toggleSort('specialty')} className={styles.sortable}>التخصّص <SortArrow k="specialty"/></th>
                          <th>الخبرة</th>
                          <th>أدوات AI</th>
                          <th onClick={()=>toggleSort('created_at')} className={styles.sortable}>تاريخ التسجيل <SortArrow k="created_at"/></th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((r,i) => (
                          <tr key={r.id} className={selected?.id===r.id ? styles.rowSelected : ''}>
                            <td className={styles.num}>{(page-1)*PER_PAGE+i+1}</td>
                            <td>
                              <div className={styles.nameCell}>
                                <div className={styles.avatar} style={{background:`hsl(${((r.full_name||'').charCodeAt(0)*7)%360},45%,65%)`}}>
                                  {(r.full_name||'؟')[0]}
                                </div>
                                <span className={styles.nameText}>{r.full_name}</span>
                              </div>
                            </td>
                            <td className={styles.mono}>{r.email}</td>
                            <td className={styles.mono}>{r.mobile}</td>
                            <td>{r.city||'—'}</td>
                            <td><span className={styles.specBadge}>{SPECIALTY_LABELS[r.specialty]||r.specialty}</span></td>
                            <td>{EXP_LABELS[r.experience]||'—'}</td>
                            <td>
                              <span className={styles.aiBadge} style={{color:AI_COLORS[r.ai_experience]||'var(--ink-500)',borderColor:AI_COLORS[r.ai_experience]||'var(--ink-200)'}}>
                                {AI_LABELS[r.ai_experience]||'—'}
                              </span>
                            </td>
                            <td className={styles.dateCell}>{fmtDate(r.created_at)}</td>
                            <td>
                              <button className={styles.detailBtn} onClick={()=>setSelected(selected?.id===r.id?null:r)}>
                                {selected?.id===r.id ? '✕' : 'تفاصيل'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button disabled={page===1} onClick={()=>setPage(p=>p-1)}>السابق</button>
                      {Array.from({length:totalPages},(_,i)=>(
                        <button key={i+1} className={page===i+1?styles.pageActive:''} onClick={()=>setPage(i+1)}>{i+1}</button>
                      ))}
                      <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>التالي</button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className={styles.detailPanel}>
                <div className={styles.detailHead}>
                  <div className={styles.avatar} style={{width:52,height:52,fontSize:22,flexShrink:0,background:`hsl(${((selected.full_name||'').charCodeAt(0)*7)%360},45%,65%)`}}>
                    {(selected.full_name||'؟')[0]}
                  </div>
                  <div>
                    <div className={styles.detailName}>{selected.full_name}</div>
                    <div className={styles.detailSub}>{SPECIALTY_LABELS[selected.specialty]||selected.specialty} · {selected.city||'—'}</div>
                  </div>
                  <button className={styles.closeBtn} onClick={()=>setSelected(null)}>✕</button>
                </div>
                <div className={styles.detailGrid}>
                  {[
                    {l:'البريد الإلكتروني', v:selected.email},
                    {l:'رقم الجوال',        v:selected.mobile},
                    {l:'المدينة',            v:selected.city||'—'},
                    {l:'التخصص',            v:SPECIALTY_LABELS[selected.specialty]||selected.specialty},
                    {l:'سنوات الخبرة',      v:EXP_LABELS[selected.experience]||'—'},
                    {l:'أدوات AI',          v:AI_LABELS[selected.ai_experience]||'—'},
                    {l:'تاريخ التسجيل',     v:fmtDate(selected.created_at)},
                  ].map(({l,v}) => (
                    <div key={l} className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l}</span>
                      <span className={styles.detailValue}>{v}</span>
                    </div>
                  ))}
                  {selected.portfolio && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>رابط الأعمال</span>
                      <a href={selected.portfolio} target="_blank" rel="noreferrer" className={styles.detailLink}>{selected.portfolio}</a>
                    </div>
                  )}
                  {selected.notes && (
                    <div className={`${styles.detailRow} ${styles.detailRowFull}`}>
                      <span className={styles.detailLabel}>دافع الانضمام</span>
                      <span className={styles.detailValue}>{selected.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <footer className={styles.footer}>
        لوحة الإدارة · تبصُّر {new Date().getFullYear()} · للاستخدام الداخلي فقط
      </footer>
    </div>
  )
}
