import { useCallback, useEffect, useMemo, useState } from 'react'
import { callSubmissions } from '../../lib/submissions'
import { remoteTracks, formatBytes } from '../../lib/remote-camp'
import { csvCell, toSafeHttpUrl } from '../../lib/security'
import styles from '../Admin.module.css'

const TYPE_LABELS = { inperson: 'حضوري', online: 'أونلاين', mixed: 'مختلط' }
const TYPE_CLASS = { inperson: styles.pillIn, online: styles.pillOn, mixed: styles.pillMix }
const TRACK_TITLES = Object.fromEntries(remoteTracks.map(track => [track.id, track.title]))
const GB = 1024 * 1024 * 1024
const ERROR_TEXT = {
  UNAUTHORIZED: 'انتهت الجلسة. سجّلي الدخول من جديد.', FORBIDDEN: 'هذا الحساب ليس في جدول admin_users.',
  DB_NOT_CONFIGURED: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط على السيرفر.', DB_UNAVAILABLE: 'تعذّر الوصول إلى قاعدة البيانات. تأكدي من تشغيل ملف supabase/submissions-2026-11-10.sql.',
  INVALID_CLIENT_ID: 'معرّف العميل غير صحيح: ينتهي بـ .apps.googleusercontent.com', INVALID_CLIENT_SECRET: 'السر غير صحيح.',
  INVALID_DEADLINE: 'الموعد النهائي غير صحيح.', INVALID_MAX_BYTES: 'الحد الأقصى غير صحيح.', LAST_MEMBER: 'لا يمكن حذف آخر عضو؛ احذفي الفريق كاملًا.',
  NETWORK: 'تعذّر الاتصال بالخادم.', DRIVE_NOT_CONNECTED: 'درايف غير مربوط.',
}
const DRIVE_ERRORS = {
  STATE_MISMATCH: 'انتهت صلاحية طلب الربط أو لم يتطابق. أعيدي الضغط على «اربط درايف».', STATE_EXPIRED: 'انتهت صلاحية طلب الربط (15 دقيقة). أعيدي المحاولة.',
  OAUTH_EXCHANGE_FAILED: 'رفض Google الرمز. تأكدي من معرّف العميل والسر وأن رابط العودة مضاف في Google Cloud بالضبط.', OAUTH_NO_REFRESH_TOKEN: 'لم يرسل Google رمز تجديد. أعيدي الربط واختاري الحساب الصحيح.',
  access_denied: 'أُلغيت الموافقة من صفحة Google.', redirect_uri_mismatch: 'رابط العودة غير مطابق لما في Google Cloud.',
}
const fmt = iso => (iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

function exportTeamsCSV(teams) {
  const headers = ['#', 'الكود', 'الفريق', 'المسار', 'النوع', 'الأعضاء', 'أرقام الجوال', 'عنوان الفيديو', 'اسم الملف', 'الحجم', 'وقت الرفع', 'رابط درايف', 'تاريخ التسجيل']
  const lines = [headers.join(','), ...teams.map((team, index) => [
    index + 1, csvCell(team.code), csvCell(team.name), csvCell(TRACK_TITLES[team.track] || team.trackLabel), csvCell(TYPE_LABELS[team.type] || team.type),
    csvCell(team.members.map(member => `${member.name}${member.leader ? ' (قائد)' : ''}${member.inPerson ? ' [حضوري]' : ''}`).join(' | ')),
    csvCell(team.members.map(member => member.mobile).join(' | ')),
    csvCell(team.video?.title || ''), csvCell(team.video?.name || ''), csvCell(team.video ? formatBytes(team.video.size, 'ar') : ''),
    csvCell(team.video ? fmt(team.video.uploadedAt) : ''), csvCell(team.video?.link || ''), csvCell(fmt(team.createdAt)),
  ].join(','))]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tabasur-submissions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SubmissionsTab({ token, onLoaded }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTrack, setFilterTrack] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [settingsForm, setSettingsForm] = useState({ open: true, deadline: '', maxGb: '2' })
  const [busy, setBusy] = useState('')
  const [driveBanner] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const status = params.get('drive')
      if (!status) return null
      window.history.replaceState(null, '', '/admin?tab=submissions')
      return status === 'connected' ? { ok: true, text: 'تم ربط Google Drive بنجاح. أُنشئ مجلد «تسليمات معسكر تَبصَّر» في درايفك وفيه مجلد لكل مسار.' } : { ok: false, text: DRIVE_ERRORS[params.get('reason')] || `تعذّر الربط (${params.get('reason') || 'خطأ غير معروف'}).` }
    } catch { return null }
  })

  const describe = err => ERROR_TEXT[err?.code] || `${err?.code || 'خطأ'}${err?.extra?.mobile ? ` (${err.extra.mobile})` : ''}`

  const load = useCallback(async () => {
    if (!token) { setLoading(false); setError(ERROR_TEXT.UNAUTHORIZED); return }
    setLoading(true); setError('')
    try {
      const result = await callSubmissions('admin_overview', {}, { token })
      setData(result)
      setSettingsForm({ open: result.settings.open, deadline: toLocalInput(result.settings.deadline), maxGb: String(result.settings.maxBytes / GB) })
      onLoaded?.(result.stats)
    } catch (err) {
      setError(describe(err))
    } finally { setLoading(false) }
  }, [token, onLoaded])

  useEffect(() => { load() }, [load])

  async function act(label, action, payload, successText) {
    setBusy(label); setError(''); setNotice('')
    try {
      const result = await callSubmissions(action, payload, { token })
      if (successText) setNotice(successText)
      return result
    } catch (err) { setError(describe(err)); return null } finally { setBusy('') }
  }

  async function connectDrive(event) {
    event.preventDefault()
    const result = await act('connect', 'admin_drive_begin', { clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    if (result?.url) window.location.href = result.url
  }

  async function disconnectDrive() {
    if (!window.confirm('فصل ربط درايف؟ لن يستطيع أي فريق الرفع حتى يُعاد الربط. الملفات الموجودة تبقى في درايفك.')) return
    if (await act('disconnect', 'admin_drive_disconnect', {}, 'تم فصل الربط.')) load()
  }

  async function saveSettings(event) {
    event.preventDefault()
    const payload = { open: settingsForm.open, deadline: settingsForm.deadline ? new Date(settingsForm.deadline).toISOString() : null, maxBytes: Math.round(Number(settingsForm.maxGb) * GB) }
    if (await act('settings', 'admin_settings', payload, 'تم حفظ الإعدادات.')) load()
  }

  async function deleteTeam(team) {
    if (!window.confirm(`حذف فريق «${team.name}» (${team.code}) وكل أعضائه؟ سيُنقل فيديوه إلى سلة المهملات في درايف.`)) return
    if (await act(`team-${team.id}`, 'admin_delete_team', { teamId: team.id }, `حُذف فريق ${team.code}.`)) load()
  }

  async function removeMember(team, member) {
    if (!window.confirm(`إزالة «${member.name}» من فريق ${team.code}؟ يصبح بإمكانه الانضمام إلى فريق آخر.`)) return
    if (await act(`member-${member.id}`, 'admin_remove_member', { memberId: member.id }, `أُزيل ${member.name} من ${team.code}.`)) load()
  }

  const teams = data?.teams || []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams.filter(team => (!filterType || team.type === filterType) && (!filterTrack || team.track === filterTrack) &&
      (!q || [team.code, team.name, team.video?.title, ...team.members.flatMap(member => [member.name, member.mobile])].some(value => String(value || '').toLowerCase().includes(q))))
  }, [teams, search, filterType, filterTrack])

  const drive = data?.drive
  const quota = drive?.quota ? { used: Number(drive.quota.usage || 0), limit: Number(drive.quota.limit || 0) } : null
  const quotaPercent = quota && quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const rootLink = toSafeHttpUrl(drive?.folders?.root?.link || '')

  return (
    <>
      {driveBanner && <div className={driveBanner.ok ? styles.okBanner : styles.errorBanner}>{driveBanner.text}</div>}
      {notice && <div className={styles.okBanner} role="status">{notice}</div>}
      {error && <div className={styles.errorBanner}><strong>خطأ:</strong> {error}</div>}

      {loading && !data ? (
        <div className={styles.loadingState}><div className={styles.spinner} /><span>جاري تحميل التسليمات...</span></div>
      ) : data && (
        <>
          <div className={styles.statsRow}>
            {[
              { label: 'الفرق المسجّلة', value: data.stats.teams, sub: `${data.stats.members} عضوًا`, accent: 'var(--green-600)' },
              { label: 'فرق سلّمت فيديو', value: data.stats.withVideo, sub: `${data.stats.teams - data.stats.withVideo} بلا فيديو بعد`, accent: 'var(--mauve-600)' },
              { label: 'مقبولون حضوريًا', value: data.stats.inperson, sub: 'لتصنيف الفريق حضوري/أونلاين/مختلط', accent: 'var(--gold-500)' },
              { label: 'إجمالي المسجّلين', value: data.stats.registrations, sub: 'كل من سجّل في الموقع', accent: 'var(--coral-500)' },
            ].map(stat => (
              <div className={styles.statCard} style={{ '--accent': stat.accent }} key={stat.label}>
                <div className={styles.statIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></div>
                <div className={styles.statBody}><div className={styles.statValue}>{stat.value}</div><div className={styles.statLabel}>{stat.label}</div><div className={styles.statSub}>{stat.sub}</div></div>
              </div>
            ))}
          </div>

          <div className={styles.subGrid}>
            <section className={styles.subCard} id="drive-card">
              <div className={styles.subCardHead}>
                <h3>Google Drive {drive?.connected ? <span className={`${styles.pill} ${drive.ok === false ? styles.pillMix : styles.pillIn}`}>{drive.ok === false ? 'مربوط لكن فيه خطأ' : 'مربوط'}</span> : <span className={`${styles.pill} ${styles.pillMix}`}>غير مربوط</span>}</h3>
                {drive?.connected && <button type="button" className={styles.dangerBtn} onClick={disconnectDrive} disabled={busy === 'disconnect'}>فصل الربط</button>}
              </div>
              {drive?.connected ? (
                <>
                  <p className={styles.subNote}>الحساب: <strong dir="ltr">{drive.email || drive.account?.emailAddress || '—'}</strong> · منذ {fmt(drive.connectedAt)}</p>
                  {drive.ok === false && <p className={styles.subNote} style={{ color: 'var(--coral-500)' }}>لم يستجب درايف ({drive.error}). لو كان السبب إلغاء الصلاحية من Google، افصلي الربط ثم أعيديه.</p>}
                  {quota && quota.limit > 0 && (
                    <>
                      <div className={`${styles.quotaBar} ${quotaPercent > 85 ? styles.quotaWarn : ''}`}><span style={{ width: `${quotaPercent}%` }} /></div>
                      <p className={styles.subNote}>المساحة: {formatBytes(quota.used, 'ar')} من {formatBytes(quota.limit, 'ar')} ({quotaPercent}%). {quotaPercent > 85 && 'المساحة تقارب النهاية: وسّعي Google One قبل أن تتوقف الرفعات.'}</p>
                    </>
                  )}
                  {rootLink && <p className={styles.subNote}>مجلد التسليمات في درايفك: <a href={rootLink} target="_blank" rel="noopener noreferrer">تسليمات معسكر تَبصَّر ↗</a> — لا يراه أحد غيرك.</p>}
                </>
              ) : (
                <form onSubmit={connectDrive}>
                  <p className={styles.subNote}>الرفع لا يعمل قبل ربط حساب Google الذي ستُحفظ فيه الفيديوهات. الخطوات في Google Cloud Console:</p>
                  <ol className={styles.driveSteps}>
                    <li>أنشئي مشروعًا، وفعّلي <strong>Google Drive API</strong> من API Library.</li>
                    <li>من <strong>Google Auth Platform</strong>: Get started → اسم التطبيق وبريد الدعم → Audience: <strong>External</strong> → أنشئي، ثم من تبويب Audience اضغطي <strong>Publish app</strong>.</li>
                    <li>من <strong>Clients</strong>: Create client → Web application → في Authorized redirect URIs أضيفي بالضبط: <code>{drive?.redirectUri}</code></li>
                    <li>انسخي Client ID و Client secret هنا ثم اضغطي «اربط درايف» ووافقي بحساب <strong>{drive?.pendingClientId ? 'Google' : 'Google المالك للمجلدات'}</strong>.</li>
                  </ol>
                  <div className={styles.formRow}>
                    <label>Client ID<input className={styles.authInput} dir="ltr" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" autoComplete="off" required /></label>
                    <label>Client secret<input className={styles.authInput} dir="ltr" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="GOCSPX-…" autoComplete="off" required /></label>
                  </div>
                  <button type="submit" className={styles.authButton} disabled={busy === 'connect'} id="connect-drive">{busy === 'connect' ? 'لحظة…' : 'اربط درايف'}</button>
                </form>
              )}
            </section>

            <section className={styles.subCard} id="settings-card">
              <div className={styles.subCardHead}><h3>إعدادات التسليم</h3></div>
              <form onSubmit={saveSettings} className={styles.formRow}>
                <label className={styles.toggle} style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={settingsForm.open} onChange={e => setSettingsForm(f => ({ ...f, open: e.target.checked }))} /> باب التسليم مفتوح</label>
                <label>الموعد النهائي (اختياري)<input className={styles.authInput} type="datetime-local" value={settingsForm.deadline} onChange={e => setSettingsForm(f => ({ ...f, deadline: e.target.value }))} /></label>
                <label>الحد الأقصى لحجم الفيديو
                  <select className={styles.authInput} value={settingsForm.maxGb} onChange={e => setSettingsForm(f => ({ ...f, maxGb: e.target.value }))}>
                    {['0.5', '1', '2', '4', '8'].map(gb => <option key={gb} value={gb}>{gb} غيغابايت</option>)}
                  </select>
                </label>
                <button type="submit" className={styles.authButton} disabled={busy === 'settings'}>{busy === 'settings' ? 'لحظة…' : 'حفظ الإعدادات'}</button>
              </form>
              <p className={styles.subNote}>بعد الموعد النهائي يُرفض أي رفع جديد تلقائيًا، ويبقى عرض الفرق متاحًا. الفيديو الواحد لكل فريق قاعدة ثابتة في النظام.</p>
            </section>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableHead}>
              <div className={styles.tableTitle}><span className={styles.chartEyebrow}>الفرق والفيديوهات</span><span className={styles.tableCount}>{filtered.length} فريقًا</span></div>
              <div className={styles.filters}>
                <div className={styles.searchWrap}>
                  <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input className={styles.searchInput} placeholder="ابحثي بالكود أو اسم الفريق أو عضو أو رقم جوال..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">كل الأنواع</option>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className={styles.filterSelect} value={filterTrack} onChange={e => setFilterTrack(e.target.value)}><option value="">كل المسارات</option>{remoteTracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>
                <button className={styles.refreshBtn} onClick={load} disabled={loading}>تحديث</button>
                <button className={styles.exportBtn} onClick={() => exportTeamsCSV(filtered)} disabled={filtered.length === 0}>تصدير Excel</button>
              </div>
            </div>
            {teams.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد فرق مسجّلة بعد</span><p>تظهر الفرق هنا فور تسجيلها من صفحة تسليم الفيديو.</p></div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد نتائج مطابقة</span></div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.cardTable}`}>
                  <thead><tr><th>#</th><th>الكود</th><th>الفريق</th><th>المسار</th><th>النوع</th><th>الأعضاء</th><th>الفيديو</th><th>وقت الرفع</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map((team, index) => {
                      const link = toSafeHttpUrl(team.video?.link || '')
                      return (
                        <tr key={team.id}>
                          <td className={styles.num}>{index + 1}</td>
                          <td data-label="الكود"><span className={styles.codeTag}>{team.code}</span></td>
                          <td className={styles.cellName}><div className={styles.nameCell}><div className={styles.avatar} style={{ background: 'var(--green-600)' }}>{(team.name || '؟')[0]}</div><span className={styles.nameText}>{team.name}</span></div></td>
                          <td data-label="المسار">{TRACK_TITLES[team.track] || team.trackLabel}</td>
                          <td data-label="النوع"><span className={`${styles.pill} ${TYPE_CLASS[team.type] || ''}`}>{TYPE_LABELS[team.type] || team.type}</span></td>
                          <td data-label="الأعضاء">
                            <div className={styles.memberChips}>{team.members.map(member => (
                              <span key={member.id} className={`${styles.chip} ${member.inPerson ? styles.chipIn : ''}`} title={`${member.mobile}${member.inPerson ? ' · حضوري' : ' · أونلاين'}`}>
                                <i />{member.leader ? <b>{member.name}</b> : member.name}
                                {team.members.length > 1 && <button type="button" className={styles.iconBtn} aria-label={`إزالة ${member.name}`} onClick={() => removeMember(team, member)} disabled={busy === `member-${member.id}`}>×</button>}
                              </span>
                            ))}</div>
                          </td>
                          <td data-label="الفيديو">
                            {team.video
                              ? <div><strong>{team.video.title}</strong><div className={styles.mono} style={{ fontSize: 12 }}>{formatBytes(team.video.size, 'ar')}{link && <> · <a href={link} target="_blank" rel="noopener noreferrer">فتح في درايف ↗</a></>}</div></div>
                              : team.pending ? <span className={styles.subNote}>رفع لم يكتمل ({team.pending.fileName})</span> : <span className={styles.subNote}>لا يوجد</span>}
                          </td>
                          <td className={styles.dateCell} data-label="وقت الرفع">{team.video ? fmt(team.video.uploadedAt) : '—'}</td>
                          <td><button type="button" className={styles.dangerBtn} onClick={() => deleteTeam(team)} disabled={busy === `team-${team.id}`}>حذف الفريق</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
