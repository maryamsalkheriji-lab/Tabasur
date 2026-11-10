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
  STORAGE_NOT_CONFIGURED: 'التخزين غير مضبوط على السيرفر.', STORAGE_SIGN_URL_FAILED: 'تعذّر إنشاء رابط المشاهدة؛ تأكدي أن حاوية submissions موجودة.',
  VIDEO_NOT_FOUND: 'لا يوجد فيديو لهذا الفريق.', INVALID_DEADLINE: 'الموعد النهائي غير صحيح.', INVALID_MAX_BYTES: 'الحد الأقصى غير صحيح.',
  LAST_MEMBER: 'لا يمكن حذف آخر عضو؛ احذفي الفريق كاملًا.', NETWORK: 'تعذّر الاتصال بالخادم.',
}
const fmt = iso => (iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

function exportTeamsCSV(teams) {
  const headers = ['#', 'الكود', 'الفريق', 'المسار', 'النوع', 'الأعضاء', 'أرقام الجوال', 'عنوان الفيديو', 'اسم الملف', 'الحجم', 'وقت الرفع', 'مسار الملف في التخزين', 'تاريخ التسجيل']
  const lines = [headers.join(','), ...teams.map((team, index) => [
    index + 1, csvCell(team.code), csvCell(team.name), csvCell(TRACK_TITLES[team.track] || team.trackLabel), csvCell(TYPE_LABELS[team.type] || team.type),
    csvCell(team.members.map(member => `${member.name}${member.leader ? ' (قائد)' : ''}${member.inPerson ? ' [حضوري]' : ''}`).join(' | ')),
    csvCell(team.members.map(member => member.mobile).join(' | ')),
    csvCell(team.video?.title || ''), csvCell(team.video?.name || ''), csvCell(team.video ? formatBytes(team.video.size, 'ar') : ''),
    csvCell(team.video ? fmt(team.video.uploadedAt) : ''), csvCell(team.video?.path || ''), csvCell(fmt(team.createdAt)),
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
  const [settingsForm, setSettingsForm] = useState({ open: true, deadline: '', maxGb: '2' })
  const [busy, setBusy] = useState('')

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

  async function saveSettings(event) {
    event.preventDefault()
    const payload = { open: settingsForm.open, deadline: settingsForm.deadline ? new Date(settingsForm.deadline).toISOString() : null, maxBytes: Math.round(Number(settingsForm.maxGb) * GB) }
    if (await act('settings', 'admin_settings', payload, 'تم حفظ الإعدادات.')) load()
  }

  async function openVideo(team, download = false) {
    const result = await act(`video-${team.id}`, 'admin_video_url', { teamId: team.id })
    const url = toSafeHttpUrl(download ? result?.downloadUrl : result?.url)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function deleteTeam(team) {
    if (!window.confirm(`حذف فريق «${team.name}» (${team.code}) وكل أعضائه؟ سيُحذف فيديوه من التخزين نهائيًا.`)) return
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

  const storage = data?.storage
  const usedPercent = storage?.includedBytes ? Math.min(100, Math.round((storage.usedBytes / storage.includedBytes) * 100)) : 0

  return (
    <>
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
            <section className={styles.subCard} id="storage-card">
              <div className={styles.subCardHead}>
                <h3>التخزين (Supabase Storage) {storage?.configured ? <span className={`${styles.pill} ${styles.pillIn}`}>جاهز</span> : <span className={`${styles.pill} ${styles.pillMix}`}>غير مضبوط</span>}</h3>
              </div>
              {storage?.configured ? (
                <>
                  <div className={`${styles.quotaBar} ${usedPercent > 85 ? styles.quotaWarn : ''}`}><span style={{ width: `${usedPercent}%` }} /></div>
                  <p className={styles.subNote}>
                    الفيديوهات المعتمدة تشغل <strong>{formatBytes(storage.usedBytes, 'ar')}</strong> من {formatBytes(storage.includedBytes, 'ar')} المضمّنة في خطة Pro ({usedPercent}%).
                    {usedPercent > 85 && ' تجاوز المضمّن يُحسب بنحو 0.08 ريال لكل غيغابايت شهريًا، فلا يتوقف الرفع.'}
                  </p>
                  <p className={styles.subNote}>الحاوية <code>{storage.bucket}</code> خاصة بالكامل: لا يراها المشاركون، والمشاهدة من هنا بروابط مؤقتة صالحة ساعة واحدة. تأكدي أن «Global file size limit» في إعدادات Storage لا يقل عن الحد الأقصى المختار أدناه.</p>
                </>
              ) : (
                <p className={styles.subNote}>شغّلي ملف <code>supabase/submissions-2026-11-10.sql</code> لإنشاء الحاوية، وتأكدي من ضبط <code>SUPABASE_SERVICE_ROLE_KEY</code> على السيرفر.</p>
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
                    {filtered.map((team, index) => (
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
                            ? <div><strong>{team.video.title}</strong>
                              <div className={styles.mono} style={{ fontSize: 12 }}>{formatBytes(team.video.size, 'ar')}
                                {' · '}<button type="button" className={styles.detailBtn} onClick={() => openVideo(team)} disabled={busy === `video-${team.id}`}>مشاهدة</button>
                                {' '}<button type="button" className={styles.detailBtn} onClick={() => openVideo(team, true)} disabled={busy === `video-${team.id}`}>تنزيل</button>
                              </div></div>
                            : team.pending ? <span className={styles.subNote}>رفع لم يكتمل ({team.pending.fileName})</span> : <span className={styles.subNote}>لا يوجد</span>}
                        </td>
                        <td className={styles.dateCell} data-label="وقت الرفع">{team.video ? fmt(team.video.uploadedAt) : '—'}</td>
                        <td><button type="button" className={styles.dangerBtn} onClick={() => deleteTeam(team)} disabled={busy === `team-${team.id}`}>حذف الفريق</button></td>
                      </tr>
                    ))}
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
