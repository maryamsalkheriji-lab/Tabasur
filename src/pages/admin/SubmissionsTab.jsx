import { useCallback, useEffect, useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import { callSubmissions } from '../../lib/submissions'
import { remoteTracks, formatBytes } from '../../lib/remote-camp'
import { csvCell, toSafeHttpUrl } from '../../lib/security'
import styles from '../Admin.module.css'

const TYPE_LABELS = { inperson: 'حضوري', online: 'أونلاين', mixed: 'مختلط' }
const TYPE_CLASS = { inperson: styles.pillIn, online: styles.pillOn, mixed: styles.pillMix }
const TRACK_TITLES = Object.fromEntries(remoteTracks.map(track => [track.id, track.title]))
const TRACK_ORDER = Object.fromEntries(remoteTracks.map((track, index) => [track.id, index]))
// قرار المنظّمة على الفيديو: داخلي تمامًا، لا يظهر للمشاركين في أي صفحة
const REVIEW_LABELS = { pending: 'بلا قرار', qualified: 'متأهل', rejected: 'غير متأهل' }
const REVIEW_CLASS = { qualified: styles.pillOk, rejected: styles.pillNo }
const REVIEW_SQL = 'supabase/review-2026-11-12.sql'
const CONSENTS_SQL = 'supabase/consents-2026-11-15.sql'
const GB = 1024 * 1024 * 1024
const ERROR_TEXT = {
  UNAUTHORIZED: 'انتهت الجلسة. سجّلي الدخول من جديد.', FORBIDDEN: 'هذا الحساب ليس في جدول admin_users.',
  DB_NOT_CONFIGURED: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط على السيرفر.', DB_UNAVAILABLE: 'تعذّر الوصول إلى قاعدة البيانات. تأكدي من تشغيل ملف supabase/submissions-2026-11-10.sql.',
  STORAGE_NOT_CONFIGURED: 'التخزين غير مضبوط على السيرفر.', STORAGE_SIGN_URL_FAILED: 'تعذّر إنشاء رابط المشاهدة؛ تأكدي أن حاوية submissions موجودة.',
  VIDEO_NOT_FOUND: 'لا يوجد فيديو لهذا الفريق.', INVALID_DEADLINE: 'الموعد النهائي غير صحيح.', INVALID_MAX_BYTES: 'الحد الأقصى غير صحيح.',
  LAST_MEMBER: 'لا يمكن حذف آخر عضو؛ احذفي الفريق كاملًا.', NETWORK: 'تعذّر الاتصال بالخادم.',
  INVALID_REVIEW: 'قرار غير معروف.', TEAM_NOT_FOUND: 'هذا الفريق لم يعد موجودًا. اضغطي «تحديث».',
  REVIEW_NOT_MIGRATED: `أزرار التأهّل تحتاج تشغيل ملف ${REVIEW_SQL} مرة واحدة في SQL Editor، ثم «تحديث».`,
  CONSENTS_NOT_MIGRATED: `الإقرارات تحتاج تشغيل ملف ${CONSENTS_SQL} مرة واحدة في SQL Editor، ثم «تحديث».`,
  CONSENT_NOT_FOUND: 'ملف الإقرار لم يعد موجودًا. اضغطي «تحديث».', INVALID_REQUEST: 'طلب غير صالح.',
}
const fmt = iso => (iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const reviewOf = team => team.review || { status: 'pending', at: null, by: null, previous: null }
const reviewText = team => (team.video ? REVIEW_LABELS[reviewOf(team).status] : '')
const consentsOf = team => team.consents || { ready: true, required: team.members.length, done: team.members.filter(member => member.consent).length, complete: true }
const consentExt = consent => (/\.([a-z0-9]+)$/i.exec(consent?.path || consent?.fileName || '') || [, 'pdf'])[1].toLowerCase()
const safeName = value => String(value || '').replace(/[\\/:*?"<>|#%{}$~]/g, ' ').replace(/\s+/g, ' ').trim()

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// صف لكل عضو في كل فريق: ملف إقراره إن وُجد (تبويب «الإقرارات»)
function consentRows(teams) {
  return teams
    .slice().sort((a, b) => (TRACK_ORDER[a.track] ?? 9) - (TRACK_ORDER[b.track] ?? 9) || a.code.localeCompare(b.code))
    .flatMap(team => team.members.map(member => ({ key: member.id, team, member, consent: member.consent || null })))
}

function exportConsentsCSV(rows) {
  const headers = ['#', 'الكود', 'الفريق', 'المسار', 'العضو', 'رقم الهوية', 'الجوال', 'الحالة', 'اسم الملف', 'الحجم', 'وقت الرفع', 'مسار الملف في التخزين']
  const lines = [headers.join(','), ...rows.map((row, index) => [
    index + 1, csvCell(row.team.code), csvCell(row.team.name), csvCell(TRACK_TITLES[row.team.track] || row.team.trackLabel), csvCell(row.member.name),
    csvCell(row.consent?.nationalId || ''), csvCell(row.member.mobile), csvCell(row.consent ? 'مرفوع' : 'لم يُرفع'),
    csvCell(row.consent?.fileName || ''), csvCell(row.consent ? formatBytes(row.consent.size, 'ar') : ''), csvCell(row.consent ? fmt(row.consent.uploadedAt) : ''), csvCell(row.consent?.path || ''),
  ].join(','))]
  downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `tabasur-consents-${new Date().toISOString().slice(0, 10)}.csv`)
}

function exportTeamsCSV(teams, label) {
  const headers = ['#', 'الكود', 'الفريق', 'المسار', 'النوع', 'الأعضاء', 'أرقام الجوال', 'الإقرارات', 'عنوان الفيديو', 'اسم الملف', 'الحجم', 'وقت الرفع', 'القرار', 'وقت القرار', 'مسار الملف في التخزين', 'تاريخ التسجيل']
  const lines = [headers.join(','), ...teams.map((team, index) => [
    index + 1, csvCell(team.code), csvCell(team.name), csvCell(TRACK_TITLES[team.track] || team.trackLabel), csvCell(TYPE_LABELS[team.type] || team.type),
    csvCell(team.members.map(member => `${member.name}${member.leader ? ' (قائد)' : ''}${member.inPerson ? ' [حضوري]' : ''}`).join(' | ')),
    csvCell(team.members.map(member => member.mobile).join(' | ')),
    csvCell(`${consentsOf(team).done} من ${consentsOf(team).required}`),
    csvCell(team.video?.title || ''), csvCell(team.video?.name || ''), csvCell(team.video ? formatBytes(team.video.size, 'ar') : ''),
    csvCell(team.video ? fmt(team.video.uploadedAt) : ''), csvCell(reviewText(team)), csvCell(reviewOf(team).at ? fmt(reviewOf(team).at) : ''),
    csvCell(team.video?.path || ''), csvCell(fmt(team.createdAt)),
  ].join(','))]
  downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `tabasur-${label}-${new Date().toISOString().slice(0, 10)}.csv`)
}

// view = 'all' تبويب «التسليمات» (كل الفرق مع أزرار القرار) · view = 'qualified' تبويب «المتأهلون» (الفرق التي تأهّل فيديوها فقط)
// view = 'consents' تبويب «الإقرارات» (ملف الإقرار الموقّع لكل عضو، للمراجعة والأرشفة)
export default function SubmissionsTab({ token, onLoaded, view = 'all' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTrack, setFilterTrack] = useState('')
  const [filterReview, setFilterReview] = useState('')
  const [filterConsent, setFilterConsent] = useState('')
  const [settingsForm, setSettingsForm] = useState({ open: true, deadline: '', maxGb: '2' })
  const [busy, setBusy] = useState('')
  const [zipProgress, setZipProgress] = useState('')
  const qualifiedView = view === 'qualified'
  const consentsView = view === 'consents'

  const describe = err => ERROR_TEXT[err?.code] || `${err?.code || 'خطأ'}${err?.extra?.mobile ? ` (${err.extra.mobile})` : ''}`

  const load = useCallback(async () => {
    if (!token) { setLoading(false); setError(ERROR_TEXT.UNAUTHORIZED); return }
    setLoading(true); setError('')
    try {
      const result = await callSubmissions('admin_overview', {}, { token })
      setData(result)
      setSettingsForm({ open: result.settings.open, deadline: toLocalInput(result.settings.deadline), maxGb: String(result.settings.maxBytes / GB) })
    } catch (err) {
      setError(describe(err))
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])
  // عند التنقل بين «التسليمات» و«المتأهلون» تبدأ المرشّحات من جديد حتى لا تختفي نتائج بسبب بحث قديم
  useEffect(() => { setSearch(''); setFilterType(''); setFilterTrack(''); setFilterReview(''); setFilterConsent(''); setNotice(''); setError('') }, [view])

  const teams = data?.teams || []
  const consentsReady = data?.consents?.ready !== false
  const counts = useMemo(() => {
    const withVideo = teams.filter(team => team.video)
    const by = status => withVideo.filter(team => reviewOf(team).status === status).length
    const complete = teams.filter(team => consentsOf(team).done === consentsOf(team).required).length
    return {
      withVideo: withVideo.length, qualified: by('qualified'), rejected: by('rejected'), undecided: by('pending'),
      consentFiles: teams.reduce((sum, team) => sum + team.members.filter(member => member.consent).length, 0),
      consentsComplete: complete, consentsIncomplete: teams.length - complete,
      membersMissing: teams.reduce((sum, team) => sum + team.members.filter(member => !member.consent).length, 0),
      videoWithoutConsents: withVideo.filter(team => consentsOf(team).done < consentsOf(team).required).length,
    }
  }, [teams])
  useEffect(() => { if (data) onLoaded?.({ ...data.stats, ...counts }) }, [data, counts, onLoaded])

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

  async function openConsent(consent, download = false) {
    const result = await act(`consent-${consent.id}`, 'admin_consent_urls', { consentIds: [consent.id] })
    const file = result?.files?.[0]
    const url = toSafeHttpUrl(download ? file?.downloadUrl : file?.url)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // ملف ZIP واحد بكل الإقرارات المعروضة: مجلد لكل فريق، وداخله ملف كل عضو باسمه ورقم هويته (للأرشفة على قرص خارجي)
  async function downloadConsentsZip(rows) {
    const withFile = rows.filter(row => row.consent)
    if (!withFile.length) return
    setBusy('zip'); setError(''); setZipProgress(`جارٍ تجهيز ${withFile.length} ملفًا…`)
    try {
      const files = {}
      for (let offset = 0; offset < withFile.length; offset += 100) {
        const batch = withFile.slice(offset, offset + 100)
        const result = await callSubmissions('admin_consent_urls', { consentIds: batch.map(row => row.consent.id) }, { token })
        for (const row of batch) {
          const file = result.files.find(item => item.id === row.consent.id)
          const url = toSafeHttpUrl(file?.url)
          if (!url) continue
          setZipProgress(`جارٍ التنزيل ${Object.keys(files).length + 1} من ${withFile.length}…`)
          const response = await fetch(url)
          if (!response.ok) throw new Error(`HTTP_${response.status}`)
          const name = `${safeName(`${row.team.code} - ${row.team.name}`)}/${safeName(`${row.member.name} - ${row.consent.nationalId}`)}.${consentExt(row.consent)}`
          files[name] = [new Uint8Array(await response.arrayBuffer()), { level: 0 }]
        }
      }
      setZipProgress('جارٍ ضغط الملفات…')
      const zipped = zipSync(files)
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `tabasur-consents-${new Date().toISOString().slice(0, 10)}.zip`)
      setNotice(`نُزّل ملف ZIP يحوي ${Object.keys(files).length} إقرارًا.`)
    } catch (err) {
      setError(err?.code ? describe(err) : 'تعذّر تنزيل بعض الملفات. حاولي مرة أخرى أو نزّلي الملفات واحدًا واحدًا.')
    } finally { setBusy(''); setZipProgress('') }
  }

  async function deleteTeam(team) {
    if (!window.confirm(`حذف فريق «${team.name}» (${team.code}) وكل أعضائه؟ سيُحذف فيديوه من التخزين نهائيًا.`)) return
    if (await act(`team-${team.id}`, 'admin_delete_team', { teamId: team.id }, `حُذف فريق ${team.code}.`)) load()
  }

  async function removeMember(team, member) {
    if (!window.confirm(`إزالة «${member.name}» من فريق ${team.code}؟ يصبح بإمكانه الانضمام إلى فريق آخر.`)) return
    if (await act(`member-${member.id}`, 'admin_remove_member', { memberId: member.id }, `أُزيل ${member.name} من ${team.code}.`)) load()
  }

  // القرار يُحفظ في الخادم ثم يُحدَّث الصف محليًا دون إعادة تحميل الجدول كله
  async function decide(team, status, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    const texts = { qualified: `${team.code} «${team.name}» انتقل إلى المتأهلين.`, rejected: `${team.code} «${team.name}»: غير متأهل.`, pending: `أُلغي قرار ${team.code}؛ يمكن اتخاذ قرار جديد من تبويب «التسليمات».` }
    const result = await act(`review-${team.id}`, 'admin_review', { teamId: team.id, status }, texts[status])
    if (result) setData(current => ({ ...current, teams: current.teams.map(row => (row.id === team.id ? { ...row, review: result.review } : row)) }))
  }

  const reviewReady = data?.review?.ready !== false
  const matches = (team, q) => (!filterType || team.type === filterType) && (!filterTrack || team.track === filterTrack) &&
    (!q || [team.code, team.name, team.video?.title, ...team.members.flatMap(member => [member.name, member.mobile])].some(value => String(value || '').toLowerCase().includes(q)))
  const consentList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return consentRows(teams).filter(row => (!filterTrack || row.team.track === filterTrack) &&
      (!filterConsent || (filterConsent === 'done' ? Boolean(row.consent) : !row.consent)) &&
      (!q || [row.team.code, row.team.name, row.member.name, row.member.mobile, row.consent?.nationalId].some(value => String(value || '').toLowerCase().includes(q))))
  }, [teams, search, filterTrack, filterConsent])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (qualifiedView) {
      return teams.filter(team => team.video && reviewOf(team).status === 'qualified' && matches(team, q))
        .sort((a, b) => (TRACK_ORDER[a.track] ?? 9) - (TRACK_ORDER[b.track] ?? 9) || a.code.localeCompare(b.code))
    }
    return teams.filter(team => matches(team, q) && (!filterReview || (Boolean(team.video) && reviewOf(team).status === filterReview)))
  }, [teams, search, filterType, filterTrack, filterReview, qualifiedView]) // eslint-disable-line react-hooks/exhaustive-deps

  const storage = data?.storage
  const usedPercent = storage?.includedBytes ? Math.min(100, Math.round((storage.usedBytes / storage.includedBytes) * 100)) : 0

  const renderStat = stat => (
    <div className={styles.statCard} style={{ '--accent': stat.accent }} key={stat.label}>
      <div className={styles.statIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{stat.star ? <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" /> : <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>}</svg></div>
      <div className={styles.statBody}><div className={styles.statValue}>{stat.value}</div><div className={styles.statLabel}>{stat.label}</div><div className={styles.statSub}>{stat.sub}</div></div>
    </div>
  )

  const renderVideoCell = (team, decision = null) => (
    <td data-label={decision ? 'الفيديو والقرار' : 'الفيديو'} className={styles.cellVideo}>
      {team.video ? (
        <div className={styles.videoBox}>
          <strong>{team.video.title}</strong>
          <span className={styles.videoMeta}>{formatBytes(team.video.size, 'ar')} · رُفع {fmt(team.video.uploadedAt)}</span>
          {consentsReady && consentsOf(team).done < consentsOf(team).required && <span className={styles.staleNote}>الإقرارات ناقصة ({consentsOf(team).done} من {consentsOf(team).required})؛ راجعي تبويب «الإقرارات».</span>}
          <div className={styles.decideRow}>
            <button type="button" className={styles.detailBtn} onClick={() => openVideo(team)} disabled={busy === `video-${team.id}`}>مشاهدة</button>
            <button type="button" className={styles.detailBtn} onClick={() => openVideo(team, true)} disabled={busy === `video-${team.id}`}>تنزيل</button>
          </div>
          {decision}
        </div>
      ) : team.pending ? <span className={styles.subNote}>رفع لم يكتمل ({team.pending.fileName})</span> : <span className={styles.subNote}>لا يوجد</span>}
    </td>
  )

  // القرار يظهر تحت أزرار المشاهدة مباشرة: تشاهدين ثم تقرّرين في المكان نفسه
  const renderDecision = team => {
    const review = reviewOf(team)
    const disabled = !reviewReady || busy === `review-${team.id}`
    if (review.status === 'pending') {
      return (
        <div className={styles.decideBox}>
          {review.previous && <span className={styles.staleNote}>استُبدل الفيديو بعد قرار سابق ({REVIEW_LABELS[review.previous]})؛ يلزم قرار جديد.</span>}
          <div className={styles.decideRow}>
            <button type="button" className={styles.okBtn} onClick={() => decide(team, 'qualified')} disabled={disabled}>يتأهل</button>
            <button type="button" className={styles.noBtn} onClick={() => decide(team, 'rejected')} disabled={disabled}>لا يتأهل</button>
          </div>
        </div>
      )
    }
    return (
      <div className={styles.decideRow}>
        <span className={`${styles.pill} ${REVIEW_CLASS[review.status]}`} title={`القرار في ${fmt(review.at)}`}>{REVIEW_LABELS[review.status]}</span>
        <button type="button" className={styles.linkBtn} onClick={() => decide(team, 'pending')} disabled={disabled}>تغيير القرار</button>
      </div>
    )
  }

  // علامة الإقرار داخل شريحة العضو: خضراء تفتح الملف، أو حمراء «بلا إقرار»
  const renderConsentMark = member => {
    if (!consentsReady) return null
    return member.consent
      ? <button type="button" className={`${styles.consentMark} ${styles.consentMarkOk}`} onClick={() => openConsent(member.consent)} title={`رقم الهوية ${member.consent.nationalId} · رُفع ${fmt(member.consent.uploadedAt)} · اضغطي للمشاهدة`} disabled={busy === `consent-${member.consent.id}`}>إقرار ✓</button>
      : <span className={`${styles.consentMark} ${styles.consentMarkNo}`} title="لم يرفع هذا العضو إقراره بعد">بلا إقرار</span>
  }

  const renderMembers = (team, editable) => (
    <td data-label="الأعضاء">
      <div className={styles.memberChips}>{team.members.map(member => (
        <span key={member.id} className={`${styles.chip} ${member.inPerson ? styles.chipIn : ''}`} title={`${member.mobile}${member.inPerson ? ' · حضوري' : ' · أونلاين'}`}>
          <i />{member.leader ? <b>{member.name}</b> : member.name}
          {renderConsentMark(member)}
          {editable && team.members.length > 1 && <button type="button" className={styles.iconBtn} aria-label={`إزالة ${member.name}`} onClick={() => removeMember(team, member)} disabled={busy === `member-${member.id}`}>×</button>}
        </span>
      ))}</div>
    </td>
  )

  return (
    <>
      {notice && <div className={styles.okBanner} role="status">{notice}</div>}
      {error && <div className={styles.errorBanner}><strong>خطأ:</strong> {error}</div>}
      {data && !reviewReady && (
        <div className={styles.warnBanner} role="status" id="review-not-ready">
          <strong>خطوة واحدة لتفعيل أزرار التأهّل:</strong> شغّلي ملف <code>{REVIEW_SQL}</code> مرة واحدة في SQL Editor ثم اضغطي «تحديث». لا يؤثر على التسجيل ولا على صفحة التسليم.
        </div>
      )}

      {data && !consentsReady && (
        <div className={styles.warnBanner} role="status" id="consents-not-ready">
          <strong>خطوة واحدة لتفعيل إقرارات الأعضاء:</strong> شغّلي ملف <code>{CONSENTS_SQL}</code> مرة واحدة في SQL Editor ثم اضغطي «تحديث». حتى ذلك الحين تُرفع الفيديوهات دون إقرارات كما في السابق.
        </div>
      )}
      {zipProgress && <div className={styles.okBanner} role="status">{zipProgress}</div>}

      {loading && !data ? (
        <div className={styles.loadingState}><div className={styles.spinner} /><span>{qualifiedView ? 'جاري تحميل المتأهلين...' : consentsView ? 'جاري تحميل الإقرارات...' : 'جاري تحميل التسليمات...'}</span></div>
      ) : data && consentsView ? (
        <>
          <div className={styles.statsRow}>
            {[
              { label: 'ملفات الإقرارات', value: counts.consentFiles, sub: `${formatBytes(data.consents?.bytes || 0, 'ar')} في التخزين`, accent: 'var(--green-600)' },
              { label: 'فرق مكتملة الإقرارات', value: counts.consentsComplete, sub: `من ${data.stats.teams} فريقًا مسجّلًا`, accent: 'var(--mauve-600)' },
              { label: 'أعضاء بلا إقرار', value: counts.membersMissing, sub: `في ${counts.consentsIncomplete} فريقًا`, accent: 'var(--coral-500)' },
              { label: 'فيديوهات بإقرارات ناقصة', value: counts.videoWithoutConsents, sub: 'سلّمت الفيديو قبل اكتمال الإقرارات', accent: 'var(--gold-500)' },
            ].map(renderStat)}
          </div>

          <div className={styles.tableCard} id="consents-card">
            <div className={styles.tableHead}>
              <div className={styles.tableTitle}><span className={styles.chartEyebrow}>إقرارات الأعضاء</span><span className={styles.tableCount}>{consentList.length} عضوًا</span></div>
              <div className={styles.filters}>
                <div className={styles.searchWrap}>
                  <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input className={styles.searchInput} placeholder="ابحثي بالكود أو الفريق أو العضو أو رقم الهوية..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className={styles.filterSelect} value={filterConsent} onChange={e => setFilterConsent(e.target.value)} aria-label="حالة الإقرار"><option value="">الكل</option><option value="done">مرفوع</option><option value="missing">لم يُرفع</option></select>
                <select className={styles.filterSelect} value={filterTrack} onChange={e => setFilterTrack(e.target.value)}><option value="">كل المسارات</option>{remoteTracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>
                <button className={styles.refreshBtn} onClick={load} disabled={loading}>تحديث</button>
                <button className={styles.exportBtn} onClick={() => exportConsentsCSV(consentList)} disabled={consentList.length === 0}>تصدير Excel</button>
                <button className={styles.exportBtn} onClick={() => downloadConsentsZip(consentList)} disabled={busy === 'zip' || !consentList.some(row => row.consent)} id="download-consents-zip">{busy === 'zip' ? 'لحظة…' : 'تنزيل الكل (ZIP)'}</button>
              </div>
            </div>
            <p className={styles.tableHint}>كل عضو يرفع نموذج الإقرار موقّعًا من صفحة التسليم، ولا يُفتح رفع الفيديو للفريق قبل اكتمال إقرارات أعضائه. «تنزيل الكل» يجمع الملفات المعروضة في ملف ZIP واحد، مجلد لكل فريق، لحفظها على قرص خارجي. ابحثي بكود الفريق ثم نزّلي لتحصلي على إقرارات فريق واحد.</p>
            {teams.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد فرق مسجّلة بعد</span><p>تظهر إقرارات الأعضاء هنا فور رفعها من صفحة تسليم الفيديو.</p></div>
            ) : consentList.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد نتائج مطابقة</span></div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.cardTable} ${styles.denseTable}`}>
                  <thead><tr><th>#</th><th>الكود</th><th>الفريق</th><th>العضو</th><th>رقم الهوية</th><th>الجوال</th><th>الملف</th><th>وقت الرفع</th><th></th></tr></thead>
                  <tbody>
                    {consentList.map((row, index) => (
                      <tr key={row.key}>
                        <td className={styles.num}>{index + 1}</td>
                        <td data-label="الكود"><span className={styles.codeTag}>{row.team.code}</span></td>
                        <td data-label="الفريق" className={styles.cellName}><span className={styles.nameText}>{row.team.name}</span><span className={styles.subNote}>{TRACK_TITLES[row.team.track] || row.team.trackLabel}</span></td>
                        <td data-label="العضو" className={styles.cellName}>{row.member.leader ? <b>{row.member.name}</b> : row.member.name}</td>
                        <td data-label="رقم الهوية" className={styles.mono}>{row.consent?.nationalId || '—'}</td>
                        <td data-label="الجوال" className={styles.mono}>{row.member.mobile}</td>
                        <td data-label="الملف">{row.consent
                          ? <span className={styles.videoMeta}>{consentExt(row.consent).toUpperCase()} · {formatBytes(row.consent.size, 'ar')}</span>
                          : <span className={`${styles.pill} ${styles.pillNo}`}>لم يُرفع</span>}</td>
                        <td data-label="وقت الرفع" className={styles.dateCell}>{row.consent ? fmt(row.consent.uploadedAt) : '—'}</td>
                        <td>{row.consent && <div className={styles.decideRow}>
                          <button type="button" className={styles.detailBtn} onClick={() => openConsent(row.consent)} disabled={busy === `consent-${row.consent.id}`}>مشاهدة</button>
                          <button type="button" className={styles.detailBtn} onClick={() => openConsent(row.consent, true)} disabled={busy === `consent-${row.consent.id}`}>تنزيل</button>
                        </div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : data && qualifiedView ? (
        <>
          <div className={styles.statsRow}>
            {[
              { label: 'المتأهلون', value: counts.qualified, sub: 'تختارين الفائزين من بينهم لاحقًا', accent: 'var(--green-600)', star: true },
              { label: 'بلا قرار', value: counts.undecided, sub: 'فيديوهات تنتظر قرارك في «التسليمات»', accent: 'var(--gold-500)' },
              { label: 'غير متأهل', value: counts.rejected, sub: 'تبقى في «التسليمات» كما هي', accent: 'var(--coral-500)' },
              { label: 'فيديوهات مستلمة', value: counts.withVideo, sub: `من ${data.stats.teams} فريقًا مسجّلًا`, accent: 'var(--mauve-600)' },
            ].map(renderStat)}
          </div>

          <div className={styles.tableCard} id="qualified-card">
            <div className={styles.tableHead}>
              <div className={styles.tableTitle}><span className={styles.chartEyebrow}>المتأهلون</span><span className={styles.tableCount}>{filtered.length} فريقًا</span></div>
              <div className={styles.filters}>
                <div className={styles.searchWrap}>
                  <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input className={styles.searchInput} placeholder="ابحثي بالكود أو اسم الفريق أو عضو..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className={styles.filterSelect} value={filterTrack} onChange={e => setFilterTrack(e.target.value)}><option value="">كل المسارات</option>{remoteTracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>
                <button className={styles.refreshBtn} onClick={load} disabled={loading}>تحديث</button>
                <button className={styles.exportBtn} onClick={() => exportTeamsCSV(filtered, 'qualified')} disabled={filtered.length === 0}>تصدير Excel</button>
              </div>
            </div>
            {counts.qualified === 0 ? (
              <div className={styles.emptyState}><span>لا يوجد متأهلون بعد</span><p>من تبويب «التسليمات» اضغطي «يتأهل» عند فيديو الفريق، فينتقل إلى هنا. لا يرى المشاركون شيئًا من هذه القرارات.</p></div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد نتائج مطابقة</span></div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.cardTable} ${styles.denseTable}`}>
                  <thead><tr><th>#</th><th>الكود</th><th>الفريق</th><th>المسار</th><th>النوع</th><th>الأعضاء</th><th>الفيديو</th><th>القرار</th></tr></thead>
                  <tbody>
                    {filtered.map((team, index) => (
                      <tr key={team.id}>
                        <td className={styles.num}>{index + 1}</td>
                        <td data-label="الكود"><span className={styles.codeTag}>{team.code}</span></td>
                        <td className={styles.cellName}><div className={styles.nameCell}><div className={styles.avatar} style={{ background: 'var(--green-600)' }}>{(team.name || '؟')[0]}</div><span className={styles.nameText}>{team.name}</span></div></td>
                        <td data-label="المسار">{TRACK_TITLES[team.track] || team.trackLabel}</td>
                        <td data-label="النوع"><span className={`${styles.pill} ${TYPE_CLASS[team.type] || ''}`}>{TYPE_LABELS[team.type] || team.type}</span></td>
                        {renderMembers(team, false)}
                        {renderVideoCell(team)}
                        <td data-label="القرار" className={styles.cellDecide}>
                          <div className={styles.decideBox}>
                            <span className={`${styles.pill} ${styles.pillOk}`}>متأهل</span>
                            <span className={styles.videoMeta}>{fmt(reviewOf(team).at)}</span>
                            <button type="button" className={styles.noBtn} onClick={() => decide(team, 'pending', `إلغاء تأهّل فريق «${team.name}» (${team.code})؟ يعود إلى «بلا قرار» في تبويب التسليمات، ولا يُحذف شيء.`)} disabled={!reviewReady || busy === `review-${team.id}`}>إلغاء التأهّل</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : data && (
        <>
          <div className={styles.statsRow}>
            {[
              { label: 'الفرق المسجّلة', value: data.stats.teams, sub: `${data.stats.members} عضوًا`, accent: 'var(--green-600)' },
              { label: 'فرق سلّمت فيديو', value: counts.withVideo, sub: `${data.stats.teams - counts.withVideo} بلا فيديو بعد`, accent: 'var(--mauve-600)' },
              { label: 'المتأهلون', value: counts.qualified, sub: `${counts.undecided} بلا قرار · ${counts.rejected} غير متأهل`, accent: 'var(--gold-500)', star: true },
              { label: 'فرق مكتملة الإقرارات', value: consentsReady ? counts.consentsComplete : '—', sub: consentsReady ? `${counts.membersMissing} عضوًا بلا إقرار` : 'بانتظار تشغيل ملف SQL', accent: 'var(--coral-500)' },
            ].map(renderStat)}
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

          <div className={styles.tableCard} id="teams-card">
            <div className={styles.tableHead}>
              <div className={styles.tableTitle}><span className={styles.chartEyebrow}>الفرق والفيديوهات</span><span className={styles.tableCount}>{filtered.length} فريقًا</span></div>
              <div className={styles.filters}>
                <div className={styles.searchWrap}>
                  <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input className={styles.searchInput} placeholder="ابحثي بالكود أو اسم الفريق أو عضو أو رقم جوال..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className={styles.filterSelect} value={filterReview} onChange={e => setFilterReview(e.target.value)} aria-label="القرار"><option value="">كل القرارات</option>{Object.entries(REVIEW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">كل الأنواع</option>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className={styles.filterSelect} value={filterTrack} onChange={e => setFilterTrack(e.target.value)}><option value="">كل المسارات</option>{remoteTracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>
                <button className={styles.refreshBtn} onClick={load} disabled={loading}>تحديث</button>
                <button className={styles.exportBtn} onClick={() => exportTeamsCSV(filtered, 'submissions')} disabled={filtered.length === 0}>تصدير Excel</button>
              </div>
            </div>
            <p className={styles.tableHint}>عند كل فيديو زرّان: «يتأهل» ينقل الفريق إلى تبويب «المتأهلون»، و«لا يتأهل» يبقيه هنا. القرار داخلي ولا يظهر للمشاركين، ويمكن تغييره في أي وقت. العلامة الخضراء «إقرار ✓» عند اسم العضو تفتح إقراره الموقّع.</p>
            {teams.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد فرق مسجّلة بعد</span><p>تظهر الفرق هنا فور تسجيلها من صفحة تسليم الفيديو.</p></div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyState}><span>لا توجد نتائج مطابقة</span></div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.cardTable} ${styles.denseTable}`}>
                  <thead><tr><th>#</th><th>الكود</th><th>الفريق</th><th>المسار</th><th>النوع</th><th>الأعضاء</th><th>الفيديو والقرار</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map((team, index) => (
                      <tr key={team.id}>
                        <td className={styles.num}>{index + 1}</td>
                        <td data-label="الكود"><span className={styles.codeTag}>{team.code}</span></td>
                        <td className={styles.cellName}><div className={styles.nameCell}><div className={styles.avatar} style={{ background: 'var(--green-600)' }}>{(team.name || '؟')[0]}</div><span className={styles.nameText}>{team.name}</span></div></td>
                        <td data-label="المسار">{TRACK_TITLES[team.track] || team.trackLabel}</td>
                        <td data-label="النوع"><span className={`${styles.pill} ${TYPE_CLASS[team.type] || ''}`}>{TYPE_LABELS[team.type] || team.type}</span></td>
                        {renderMembers(team, true)}
                        {renderVideoCell(team, renderDecision(team))}
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
