import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/language'
import { remoteTracks, formatBytes } from '../lib/remote-camp'
import { DEFAULT_COUNTRY, validateMobile } from '../lib/phone'
import PhoneInput from '../components/PhoneInput'
import {
  callSubmissions, uploadResumable, uploadSigned, normalizeTeamCode, isVideoFile, isConsentFile, receiptText, whatsappShareUrl,
  MAX_MEMBERS, CONSENT_MAX_BYTES, CONSENT_TEMPLATE_URL, SubmissionError,
} from '../lib/submissions'
import { submissionErrorMessage } from '../lib/i18n-submit'
import styles from './Submit.module.css'

function Icon({ name }) {
  const paths = {
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="M10.9 12.1 21 2M15 8l3 3M18 5l3 3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    plus: <path d="M12 5v14M5 12h14" />,
    film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
    whatsapp: <><path d="M3 21l1.6-4.6A9 9 0 1 1 8.2 19.7Z" /><path d="M9 9.5c.3 1.7 1.8 3.4 3.5 4.2l1.3-1.1 2 .9c0 1.4-1 2.3-2.4 2.1C10.3 15.1 8.1 12.9 7.5 9.8 7.3 8.4 8.2 7.4 9.6 7.4l.8 2.1Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></>,
    external: <><path d="M14 4h6v6M20 4 10 14" /><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const newMember = () => ({ id: Math.random().toString(36).slice(2), country: DEFAULT_COUNTRY, number: '', status: 'idle', name: '' })
const emptyConsentForm = () => ({ nationalId: '', file: null, error: '', busy: false, progress: 0, editing: false })
const fmtDate = (iso, lang) => { try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso } }

export default function Submit() {
  const { t, lang } = useLanguage()
  const copy = t.submit
  const trackCopy = t.remote.tracks
  const [params] = useSearchParams()

  const [config, setConfig] = useState(null) // null = loading, false = failed
  const [view, setView] = useState('choose') // choose | new | existing | uploading | done
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // فريق جديد
  const [teamName, setTeamName] = useState('')
  const [track, setTrack] = useState(() => (remoteTracks.some(item => item.id === params.get('track')) ? params.get('track') : ''))
  const [members, setMembers] = useState(() => [newMember()])
  // الفيديو (الرفع الأول والاستبدال)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  // فريق موجود
  const [codeInput, setCodeInput] = useState('')
  const [memberPhone, setMemberPhone] = useState({ country: DEFAULT_COUNTRY, number: '' })
  const [team, setTeam] = useState(null)
  const [replacing, setReplacing] = useState(false)
  // إقرارات الأعضاء: نموذج لكل عضو (رقم الهوية + الملف)
  const [consentForms, setConsentForms] = useState({})
  // الرفع
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: 'uploading' })
  const [uploadFailure, setUploadFailure] = useState(null) // { code, extra }
  const [outcome, setOutcome] = useState('created')
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)
  const uploadRef = useRef(null) // { team, upload, startPayload, first, uploadUrl }
  const fileInputRef = useRef(null)
  const speedRef = useRef({ at: 0, done: 0, speed: 0 })

  useEffect(() => {
    const previous = document.title
    document.title = copy.title
    return () => { document.title = previous }
  }, [copy.title])

  useEffect(() => {
    let active = true
    callSubmissions('config').then(data => { if (active) setConfig(data) }).catch(() => { if (active) setConfig(false) })
    return () => { active = false }
  }, [])

  const ready = Boolean(config && config.open && config.uploadReady && !(config.deadline && Date.parse(config.deadline) < Date.now()))
  const maxBytes = config?.maxBytes || 2 * 1024 * 1024 * 1024
  const maxLabel = formatBytes(maxBytes, lang)
  const statusText = config === null ? copy.status.loading
    : config === false ? copy.status.notReady
    : !config.open ? copy.status.closed
    : config.deadline && Date.parse(config.deadline) < Date.now() ? copy.errors.DEADLINE_PASSED
    : !config.uploadReady ? copy.status.notReady
    : copy.status.open
  const showError = (code, extra = {}) => setError(submissionErrorMessage(copy, code, extra))
  // الإقرارات مفعّلة إلا إذا قال الخادم إن جدولها لم يُنشأ بعد (عندها يعمل التسليم كالسابق)
  const consentsActive = team?.consents?.ready !== false
  const consentsComplete = !consentsActive || Boolean(team?.consents?.complete)

  /* ─── الأعضاء: تحقق فوري من كل رقم ─── */
  const lookupTimers = useRef({})
  const updateMember = useCallback((id, patch) => setMembers(list => list.map(member => (member.id === id ? { ...member, ...patch } : member))), [])
  const scheduleLookup = useCallback((member) => {
    clearTimeout(lookupTimers.current[member.id])
    const check = validateMobile(member.country, member.number)
    if (!member.number.trim()) { updateMember(member.id, { status: 'idle', name: '' }); return }
    if (!check.ok) { updateMember(member.id, { status: member.number.replace(/\D/g, '').length >= 7 ? 'invalid' : 'idle', name: '' }); return }
    updateMember(member.id, { status: 'checking', name: '' })
    lookupTimers.current[member.id] = setTimeout(async () => {
      try {
        const data = await callSubmissions('lookup', { mobiles: [{ number: member.number, country: member.country }] })
        const result = data.results[0]
        updateMember(member.id, { status: result.status, name: result.name || '' })
      } catch (err) {
        updateMember(member.id, { status: 'idle', name: '' })
        showError(err.code || 'NETWORK')
      }
    }, 550)
  }, [updateMember]) // eslint-disable-line react-hooks/exhaustive-deps

  const duplicates = useMemo(() => {
    const seen = new Map(), dupes = new Set()
    for (const member of members) {
      const check = validateMobile(member.country, member.number)
      if (!check.ok) continue
      if (seen.has(check.stored)) dupes.add(member.id)
      seen.set(check.stored, member.id)
    }
    return dupes
  }, [members])

  function handleMemberPhone(id, value) {
    const member = { ...members.find(m => m.id === id), ...value }
    updateMember(id, value)
    scheduleLookup(member)
  }

  /* ─── ملف الفيديو ─── */
  function pickFile(selected) {
    setFileError('')
    if (!selected) { setFile(null); return }
    if (!isVideoFile(selected)) { setFile(null); setFileError(copy.video.notVideo); return }
    if (selected.size > maxBytes) { setFile(null); setFileError(copy.video.tooLarge(maxLabel)); return }
    setFile(selected)
  }

  function resetVideoForm() { setTitle(''); setFile(null); setFileError('') }

  /* ─── إقرارات الأعضاء ─── */
  const formOf = memberId => consentForms[memberId] || emptyConsentForm()
  const setConsentForm = (memberId, patch) => setConsentForms(forms => ({ ...forms, [memberId]: { ...emptyConsentForm(), ...(forms[memberId] || {}), ...patch } }))

  function pickConsentFile(memberId, selected) {
    if (!selected) { setConsentForm(memberId, { file: null, error: '' }); return }
    if (!isConsentFile(selected)) { setConsentForm(memberId, { file: null, error: copy.consent.notFile }); return }
    if (selected.size > CONSENT_MAX_BYTES) { setConsentForm(memberId, { file: null, error: copy.consent.tooLarge }); return }
    setConsentForm(memberId, { file: selected, error: '' })
  }

  async function uploadConsent(member) {
    const form = formOf(member.id)
    const nationalId = form.nationalId.trim()
    if (!validateMobile(memberPhone.country, memberPhone.number).ok) return setConsentForm(member.id, { error: submissionErrorMessage(copy, 'INVALID_MOBILE') })
    if (!/^[A-Za-z0-9٠-٩\s-]{5,24}$/.test(nationalId)) return setConsentForm(member.id, { error: submissionErrorMessage(copy, 'INVALID_NATIONAL_ID') })
    if (!form.file) return setConsentForm(member.id, { error: submissionErrorMessage(copy, 'INVALID_CONSENT_FILE') })
    setConsentForm(member.id, { busy: true, error: '', progress: 0 })
    setError('')
    const auth = { code: team.code, mobile: memberPhone.number, country: memberPhone.country, memberId: member.id, nationalId }
    try {
      const started = await callSubmissions('consent_start', { ...auth, file: { fileName: form.file.name, size: form.file.size, mimeType: form.file.type || '' } })
      await uploadSigned({
        file: form.file, url: started.upload.uploadUrl, mimeType: started.upload.mimeType, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        onProgress: (done, total) => setConsentForm(member.id, { progress: total ? Math.round((done / total) * 100) : 0 }),
      })
      const result = await callSubmissions('consent_complete', { ...auth, objectPath: started.upload.objectPath })
      setTeam(result.team)
      setConsentForms(forms => { const next = { ...forms }; delete next[member.id]; return next })
      setNotice(result.team.consents.complete ? copy.consent.complete : copy.consent.progress(result.team.consents.done, result.team.consents.required))
    } catch (err) {
      setConsentForm(member.id, { busy: false, error: submissionErrorMessage(copy, err.code || 'CONSENT_UPLOAD_FAILED', err.extra || {}) })
    }
  }

  /* ─── رفع الفيديو ─── */
  async function runUpload(startPayload, { resumeFrom } = {}) {
    setError(''); setUploadFailure(null); setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    let started = null
    try {
      started = await callSubmissions('start', startPayload, { signal: controller.signal })
      // نحتفظ برابط جلسة TUS السابقة إن كان الرفع نفسه (نفس uploadId) حتى نكمل من حيث وقف
      const previous = uploadRef.current?.upload?.uploadId === started.upload.uploadId ? uploadRef.current.uploadUrl : null
      uploadRef.current = { team: started.team, upload: started.upload, startPayload, first: !started.team.video, uploadUrl: previous }
      setTeam(started.team)
      setView('uploading')
      setProgress({ done: resumeFrom || 0, total: file.size, phase: 'uploading' })
      speedRef.current = { at: Date.now(), done: resumeFrom || 0, speed: 0 }
      await uploadResumable({
        file, endpoint: started.upload.endpoint, token: started.upload.token, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY, bucket: started.upload.bucket,
        objectPath: started.upload.objectPath, chunkSize: started.upload.chunkSize, uploadUrl: previous, signal: controller.signal,
        onUploadUrl: url => { if (uploadRef.current) uploadRef.current.uploadUrl = url },
        onRetry: () => setProgress(p => ({ ...p, phase: 'retrying' })),
        onProgress: (done, total) => {
          const now = Date.now(), prev = speedRef.current
          if (now - prev.at > 800) { speedRef.current = { at: now, done, speed: (done - prev.done) / ((now - prev.at) / 1000) } }
          setProgress({ done, total, phase: 'uploading' })
        },
      })
      setProgress(p => ({ ...p, phase: 'verifying' }))
      const done = await callSubmissions('complete', { code: started.team.code, uploadId: started.upload.uploadId })
      setTeam(done.team)
      setOutcome(uploadRef.current?.first ? 'created' : 'replaced')
      setView('done')
      resetVideoForm()
    } catch (err) {
      if (err?.name === 'AbortError') {
        const current = uploadRef.current
        if (current) callSubmissions('cancel', { code: current.team.code, uploadId: current.upload.uploadId }).catch(() => {})
        setNotice(copy.progress.cancelled)
        setView('existing')
      } else if (started) {
        setUploadFailure({ code: err.code || 'UPLOAD_FAILED', extra: err.extra || {} })
        showError(err.code || 'UPLOAD_FAILED', err.extra || {})
      } else {
        showError(err.code || 'UNKNOWN', err.extra || {})
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  async function retryUpload() {
    const current = uploadRef.current
    if (!current) return
    setBusy(true); setError('')
    try {
      const state = await callSubmissions('status', { code: current.team.code, uploadId: current.upload.uploadId })
      if (state.complete) {
        setProgress(p => ({ ...p, phase: 'verifying' }))
        const done = await callSubmissions('complete', { code: current.team.code, uploadId: current.upload.uploadId })
        setTeam(done.team); setOutcome(current.first ? 'created' : 'replaced'); setView('done'); resetVideoForm(); setBusy(false)
        return
      }
      if (state.expired && uploadRef.current) uploadRef.current.uploadUrl = null
      await runUpload(current.startPayload, { resumeFrom: progress.done || 0 })
    } catch (err) {
      setBusy(false)
      if (err.code === 'UPLOAD_EXPIRED' || err.code === 'UPLOAD_NOT_FOUND') { uploadRef.current = null; setUploadFailure(null); setView('existing') }
      showError(err.code || 'UNKNOWN', err.extra || {})
    }
  }

  function cancelUpload() { abortRef.current?.abort() }

  const videoPayload = () => ({ fileName: file.name, size: file.size, mimeType: file.type || '', title: title.trim() })

  function validateVideoForm() {
    if (title.trim().length < 2) return 'INVALID_TITLE'
    if (!file) return 'INVALID_VIDEO'
    return null
  }

  // الخطوة الأولى لفريق جديد: التسجيل فقط، ثم تأتي الإقرارات ثم الفيديو في شاشة الفريق
  async function registerTeam(event) {
    event.preventDefault()
    setError(''); setNotice('')
    if (teamName.trim().length < 2) return showError('INVALID_TEAM_NAME')
    if (!track) return showError('INVALID_TRACK')
    if (members.some(member => !validateMobile(member.country, member.number).ok)) return showError('INVALID_MOBILE')
    if (duplicates.size) return showError('DUPLICATE_MEMBER')
    const blocking = members.find(member => member.status !== 'ok')
    if (blocking) return showError(blocking.status === 'in_team' ? 'MOBILE_TAKEN' : blocking.status === 'not_registered' ? 'NOT_REGISTERED' : blocking.status === 'checking' ? 'UNKNOWN' : 'INVALID_MOBILE')
    setBusy(true)
    try {
      const data = await callSubmissions('register', { team: { mode: 'new', name: teamName.trim(), track, mobiles: members.map(member => ({ number: member.number, country: member.country })) } })
      const leader = members[0]
      setTeam(data.team); setCodeInput(data.team.code); setMemberPhone({ country: leader.country, number: leader.number })
      setReplacing(false); setConsentForms({}); resetVideoForm()
      setNotice(copy.consent.registered(data.team.code))
      setView('existing')
      try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* بيئة بلا نافذة */ }
    } catch (err) {
      showError(err.code || 'UNKNOWN', err.extra || {})
    } finally { setBusy(false) }
  }

  async function lookupTeam(event) {
    event.preventDefault()
    setError(''); setNotice(''); setTeam(null); setReplacing(false); setConsentForms({}); setBusy(true)
    try {
      const code = normalizeTeamCode(codeInput)
      const payload = code ? { code } : { mobile: memberPhone.number, country: memberPhone.country }
      if (!code && !validateMobile(memberPhone.country, memberPhone.number).ok) throw new SubmissionError('INVALID_MOBILE')
      const data = await callSubmissions('team', payload)
      setTeam(data.team)
      setCodeInput(data.team.code)
    } catch (err) {
      showError(err.code || 'UNKNOWN', err.extra || {})
    } finally { setBusy(false) }
  }

  async function submitVideo(event) {
    event.preventDefault()
    setError(''); setNotice('')
    if (!validateMobile(memberPhone.country, memberPhone.number).ok) return showError('INVALID_MOBILE')
    const problem = validateVideoForm()
    if (problem) return showError(problem)
    await runUpload({ team: { mode: 'existing', code: team.code, mobile: memberPhone.number, country: memberPhone.country }, video: videoPayload() })
  }

  async function removeVideo() {
    if (!validateMobile(memberPhone.country, memberPhone.number).ok) return showError('INVALID_MOBILE')
    if (!window.confirm(copy.actions.removeConfirm)) return
    setBusy(true); setError('')
    try {
      const data = await callSubmissions('remove_video', { code: team.code, mobile: memberPhone.number, country: memberPhone.country })
      setTeam(data.team); setNotice(copy.success.removed)
    } catch (err) { showError(err.code || 'UNKNOWN', err.extra || {}) } finally { setBusy(false) }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(team.code); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* الحافظة غير متاحة */ }
  }

  /* ─── أجزاء الواجهة: دوال عرض لا مكوّنات داخلية، حتى لا يُعاد تركيب الحقول (وفقدان التركيز) مع كل حرف ─── */
  const renderStatus = () => (
    <div className={`${styles.statusBar} ${config && ready ? styles.statusOpen : ''}`} role="status">
      <div className={styles.wrap}><Icon name={config && ready ? 'upload' : 'lock'} /><span>{statusText}</span>
        {config && ready && config.deadline && <span className={styles.statusMeta}>{copy.status.deadline(fmtDate(config.deadline, lang))}</span>}
        {config && ready && <span className={styles.statusMeta}>{copy.status.maxSize(maxLabel)}</span>}
      </div>
    </div>
  )

  const renderTeamCard = (data, compact = false) => {
    const showConsents = data.consents?.ready !== false
    return (
      <div className={styles.card} id="team-card">
        <div className={styles.cardHead}>
          <div><span className={styles.eyebrow}>{copy.card.code}</span><strong className={styles.code} dir="ltr">{data.code}</strong></div>
          <div className={styles.cardTitle}><span className={styles.eyebrow}>{copy.card.team}</span><strong>{data.name}</strong><small>{trackCopy[data.track]?.title || data.trackLabel}</small></div>
        </div>
        <div className={styles.cardBody}>
          <div><span className={styles.eyebrow}>{copy.card.members}</span>
            <ul className={styles.memberList}>{data.members.map((member, index) => (
              <li key={member.id || index}>
                <span>{member.name}</span><small dir="ltr">{member.mobile}</small>{member.leader && <em>{copy.card.leader}</em>}
                {showConsents && (member.consent ? <small className={styles.consentOk}>✓ {copy.card.consentOk}</small> : <small className={styles.consentNo}>{copy.card.consentMissing}</small>)}
              </li>
            ))}</ul>
          </div>
          <div><span className={styles.eyebrow}>{copy.card.video}</span>
            {data.video
              ? <div className={styles.videoMeta}><strong>{data.video.title}</strong><small dir="auto">{data.video.fileName}</small><small>{copy.card.size}: {formatBytes(data.video.size, lang)} · {copy.card.uploadedAt}: {fmtDate(data.video.uploadedAt, lang)}</small></div>
              : <p className={styles.muted}>{copy.card.noVideo}</p>}
            {!compact && data.pending && !data.video && <p className={styles.pendingNote}><Icon name="info" /> {copy.card.pending}</p>}
          </div>
        </div>
      </div>
    )
  }

  const renderConsentRow = (member, index) => {
    const form = formOf(member.id)
    const showForm = !member.consent || form.editing
    return (
      <li key={member.id} className={`${styles.consentRow} ${member.consent ? styles.consentRowDone : ''}`} id={`consent-${index}`}>
        <div className={styles.consentHead}>
          <strong>{member.name}</strong>{member.leader && <em>{copy.card.leader}</em>}
          {member.consent
            ? <span className={styles.chipOk}><Icon name="check" /> {copy.consent.done}</span>
            : <span className={styles.chipBad}>{copy.consent.missing}</span>}
          {member.consent && <small>{copy.card.uploadedAt}: {fmtDate(member.consent.uploadedAt, lang)}</small>}
          {member.consent && !form.editing && <button type="button" className={styles.linkButton} onClick={() => setConsentForm(member.id, { editing: true })}>{copy.consent.replace}</button>}
        </div>
        {showForm && <div className={styles.consentForm}>
          <div className={styles.consentGrid}>
            <div className="field">
              <label htmlFor={`nid-${member.id}`}>{copy.consent.nationalId}<span className="req">•</span></label>
              <input className="input" id={`nid-${member.id}`} type="text" dir="ltr" autoComplete="off" maxLength={24} placeholder={copy.consent.nationalIdPlaceholder} value={form.nationalId} onChange={event => setConsentForm(member.id, { nationalId: event.target.value, error: '' })} />
              <div className="hint">{copy.consent.nationalIdHint}</div>
            </div>
            <div className="field">
              <label htmlFor={`cfile-${member.id}`}>{copy.consent.file}<span className="req">•</span></label>
              <div className={`${styles.dropzone} ${form.file ? styles.dropzoneFilled : ''} ${form.error ? styles.dropzoneError : ''}`}
                onDragOver={event => { event.preventDefault() }}
                onDrop={event => { event.preventDefault(); pickConsentFile(member.id, event.dataTransfer.files?.[0]) }}>
                <input id={`cfile-${member.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={event => pickConsentFile(member.id, event.target.files?.[0])} />
                {form.file
                  ? <div className={styles.fileCard}><Icon name="file" /><div><strong dir="auto">{form.file.name}</strong><small>{formatBytes(form.file.size, lang)}</small></div>
                    <label htmlFor={`cfile-${member.id}`} className={styles.linkButton}>{copy.consent.change}</label></div>
                  : <label htmlFor={`cfile-${member.id}`} className={styles.dropLabel}><Icon name="upload" /><strong>{copy.consent.choose}</strong><small>{copy.consent.hint}</small></label>}
              </div>
            </div>
          </div>
          {form.error && <div className="error-msg" role="alert">{form.error}</div>}
          {form.busy && <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={form.progress}><span style={{ width: `${form.progress}%` }} /></div>}
          <div className={styles.consentActions}>
            <button type="button" className={styles.primary} onClick={() => uploadConsent(member)} disabled={form.busy} id={`upload-consent-${index}`}><Icon name="upload" /> {form.busy ? copy.consent.uploading : copy.consent.upload}</button>
            {member.consent && <button type="button" className={styles.ghost} onClick={() => setConsentForm(member.id, { editing: false, error: '', file: null })} disabled={form.busy}>{copy.consent.cancel}</button>}
          </div>
        </div>}
      </li>
    )
  }

  const renderConsents = data => {
    if (data.consents?.ready === false) return null
    const { done, required, complete } = data.consents
    return (
      <section className={styles.section} id="consents" aria-labelledby="consents-title">
        <div className={styles.sectionHead}><span className={styles.step}><Icon name="file" /></span><h2 id="consents-title">{copy.consent.sectionTitle}</h2></div>
        <div className={styles.consentIntro}>
          <p>{copy.consent.intro}</p>
          <ol className={styles.consentSteps}>{copy.consent.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          <div className={styles.actions}>
            <a className={styles.ghost} href={CONSENT_TEMPLATE_URL} download={copy.consent.templateName} target="_blank" rel="noopener noreferrer" id="download-consent"><Icon name="download" /> {copy.consent.download}</a>
          </div>
        </div>
        <p className={styles.consentProgress} aria-live="polite" id="consents-progress">{complete ? copy.consent.complete : copy.consent.progress(done, required)}</p>
        <ul className={styles.consentList}>{data.members.map(renderConsentRow)}</ul>
      </section>
    )
  }

  const renderVideoFields = idPrefix => (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>{copy.video.title}<span className="req">•</span></label>
        <input className="input" id={`${idPrefix}-title`} type="text" maxLength={80} placeholder={copy.video.titlePlaceholder} value={title} onChange={event => setTitle(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-file`}>{copy.video.file}<span className="req">•</span></label>
        <div className={`${styles.dropzone} ${file ? styles.dropzoneFilled : ''} ${fileError ? styles.dropzoneError : ''}`}
          onDragOver={event => { event.preventDefault() }}
          onDrop={event => { event.preventDefault(); pickFile(event.dataTransfer.files?.[0]) }}>
          <input ref={fileInputRef} id={`${idPrefix}-file`} type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" className={styles.fileInput} onChange={event => pickFile(event.target.files?.[0])} />
          {file
            ? <div className={styles.fileCard}><Icon name="film" /><div><strong dir="auto">{file.name}</strong><small>{formatBytes(file.size, lang)}</small></div>
              <button type="button" className={styles.linkButton} onClick={() => fileInputRef.current?.click()}>{copy.video.change}</button></div>
            : <label htmlFor={`${idPrefix}-file`} className={styles.dropLabel}><Icon name="upload" /><strong>{copy.video.choose}</strong><span>{copy.video.drop}</span><small>{copy.video.hint(maxLabel)}</small></label>}
        </div>
        {fileError && <div className="error-msg">{fileError}</div>}
      </div>
    </>
  )

  const percent = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0

  return <div className={styles.page}>
    {renderStatus()}
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/tabsur" className={styles.breadcrumb}>{copy.breadcrumbCamp} <span>/</span> {copy.breadcrumb}</Link>
        <h1 id="submit-title">{copy.heroTitle} <span>{copy.heroAccent}</span></h1>
        <p>{copy.heroText}</p>
      </header>

      {view === 'choose' && <>
        <section className={styles.modes} aria-label={copy.modes.title}>
          <button type="button" className={styles.modeCard} onClick={() => { setView('new'); setError('') }} id="mode-new">
            <span className={styles.modeIcon}><Icon name="users" /></span><strong>{copy.modes.newTitle}</strong><span>{copy.modes.newText}</span>
          </button>
          <button type="button" className={styles.modeCard} onClick={() => { setView('existing'); setError('') }} id="mode-existing">
            <span className={styles.modeIcon}><Icon name="key" /></span><strong>{copy.modes.existingTitle}</strong><span>{copy.modes.existingText}</span>
          </button>
        </section>
        <section className={styles.rules} id="submit-rules"><h2>{copy.rules.title}</h2><ul>{copy.rules.items.map((rule, index) => <li key={index}><Icon name="check" />{rule}</li>)}</ul></section>
      </>}

      {view === 'new' && <form className={styles.form} onSubmit={registerTeam} noValidate id="new-team-form">
        <section className={styles.section}>
          <div className={styles.sectionHead}><span className={styles.step}>1</span><h2>{copy.team.sectionTitle}</h2></div>
          <div className="field">
            <label htmlFor="team-name">{copy.team.name}<span className="req">•</span></label>
            <input className="input" id="team-name" type="text" maxLength={60} placeholder={copy.team.namePlaceholder} value={teamName} onChange={event => setTeamName(event.target.value)} required />
            <div className="hint">{copy.team.nameHint}</div>
          </div>
          <fieldset className={styles.trackSet}>
            <legend>{copy.team.track}<span className="req">•</span> <small>{copy.team.trackHint}</small></legend>
            <div className={styles.trackGrid}>{remoteTracks.map(item => (
              <label key={item.id} className={`${styles.trackCard} ${track === item.id ? styles.trackActive : ''}`}>
                <input type="radio" name="track" value={item.id} checked={track === item.id} onChange={() => setTrack(item.id)} />
                <img src={item.image} alt="" loading="lazy" /><span className={styles.trackNumber}>{item.number}</span>
                <strong>{trackCopy[item.id].title}</strong><small>{trackCopy[item.id].description}</small>
              </label>
            ))}</div>
          </fieldset>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><span className={styles.step}>2</span><h2>{copy.members.sectionTitle}</h2></div>
          <p className={styles.hintText}>{copy.members.hint}</p>
          <div className={styles.memberRows}>{members.map((member, index) => {
            const dup = duplicates.has(member.id)
            const status = dup ? 'duplicate' : member.status
            return <div className={`${styles.memberRow} ${styles[`status_${status}`] || ''}`} key={member.id}>
              <div className="field">
                <label htmlFor={`member-${member.id}`}>{index === 0 ? copy.members.leaderLabel : copy.members.memberLabel(index + 1)}<span className="req">•</span></label>
                <PhoneInput id={`member-${member.id}`} name={`member-${index}`} lang={lang} labels={t.phone} country={member.country} number={member.number} onChange={value => handleMemberPhone(member.id, value)} />
                <div className={styles.memberStatus} aria-live="polite">
                  {status === 'checking' && <span className={styles.chipMuted}>{copy.members.checking}</span>}
                  {status === 'ok' && <span className={styles.chipOk}><Icon name="check" /> {member.name} · {copy.members.ok}</span>}
                  {status === 'in_team' && <span className={styles.chipBad}><Icon name="x" /> {member.name ? `${member.name} · ` : ''}{copy.members.inTeam}</span>}
                  {status === 'not_registered' && <span className={styles.chipBad}><Icon name="x" /> {copy.members.notRegistered} · <Link to="/register">{copy.members.registerLink}</Link></span>}
                  {status === 'invalid' && <span className={styles.chipBad}><Icon name="x" /> {copy.members.invalid}</span>}
                  {status === 'duplicate' && <span className={styles.chipBad}><Icon name="x" /> {copy.members.duplicate}</span>}
                </div>
              </div>
              {index > 0 && <button type="button" className={styles.removeMember} onClick={() => setMembers(list => list.filter(item => item.id !== member.id))} aria-label={copy.members.remove}><Icon name="x" /></button>}
            </div>
          })}</div>
          {members.length < MAX_MEMBERS
            ? <button type="button" className={styles.ghost} onClick={() => setMembers(list => [...list, newMember()])} id="add-member"><Icon name="plus" /> {copy.members.add}</button>
            : <p className={styles.muted}>{copy.members.max}</p>}
        </section>

        <p className={styles.gateNote}><Icon name="info" /> {copy.consent.afterRegister}</p>
        {error && <div className="form-error-banner" role="alert">{error}</div>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={busy || !ready} id="submit-new"><Icon name="users" /> {busy ? copy.actions.working : copy.actions.registerTeam}</button>
          <button type="button" className={styles.ghost} onClick={() => { setView('choose'); setError('') }}>{copy.actions.back}</button>
        </div>
      </form>}

      {view === 'existing' && <div className={styles.form} id="existing-team">
        <form onSubmit={lookupTeam} noValidate className={styles.section}>
          <div className={styles.sectionHead}><span className={styles.step}><Icon name="key" /></span><h2>{copy.modes.existingTitle}</h2></div>
          <p className={styles.hintText}>{copy.existing.hint}</p>
          <div className={styles.lookupRow}>
            <div className="field">
              <label htmlFor="team-code">{copy.existing.code}</label>
              <input className={`input ${styles.codeInput}`} id="team-code" type="text" dir="ltr" placeholder={copy.existing.codePlaceholder} value={codeInput} onChange={event => setCodeInput(event.target.value.toUpperCase())} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="member-phone">{copy.existing.mobile}<span className="req">•</span></label>
              <PhoneInput id="member-phone" name="memberPhone" lang={lang} labels={t.phone} country={memberPhone.country} number={memberPhone.number} onChange={setMemberPhone} />
              <div className="hint">{copy.existing.orMobile}</div>
            </div>
          </div>
          {error && !team && <div className="form-error-banner" role="alert">{error}</div>}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={busy} id="lookup-team">{busy ? copy.actions.working : copy.actions.lookup}</button>
            <button type="button" className={styles.ghost} onClick={() => { setView('choose'); setError(''); setTeam(null) }}>{copy.actions.back}</button>
          </div>
        </form>

        {team && <>
          <div className={styles.section}>
            {renderTeamCard(team)}
            {notice && <div className={styles.notice} role="status">{notice}</div>}
            {error && <div className="form-error-banner" role="alert">{error}</div>}
          </div>

          {renderConsents(team)}

          <div className={styles.section} id="video-section">
            <div className={styles.sectionHead}><span className={styles.step}><Icon name="film" /></span><h2>{copy.video.sectionTitle}</h2></div>
            {!consentsComplete && <p className={styles.gateNote}><Icon name="lock" /> {copy.consent.gate}</p>}
            {!replacing && <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => { setReplacing(true); setError(''); setNotice('') }} disabled={!ready || !consentsComplete} id="replace-video"><Icon name={team.video ? 'refresh' : 'upload'} /> {team.video ? copy.actions.replace : copy.actions.submitFirst}</button>
              {team.video && <button type="button" className={styles.danger} onClick={removeVideo} disabled={busy || !ready} id="remove-video"><Icon name="trash" /> {copy.actions.remove}</button>}
            </div>}
            {replacing && <form onSubmit={submitVideo} noValidate className={styles.replaceForm} id="replace-form">
              {team.video && <p className={styles.hintText}><strong>{copy.video.replaceTitle}:</strong> {copy.video.replaceText}</p>}
              {renderVideoFields('replace')}
              <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy || !ready || !consentsComplete} id="submit-replace"><Icon name="upload" /> {busy ? copy.actions.working : team.video ? copy.actions.submitReplace : copy.actions.submitFirst}</button>
                <button type="button" className={styles.ghost} onClick={() => { setReplacing(false); setError('') }}>{copy.actions.back}</button>
              </div>
            </form>}
          </div>
        </>}
      </div>}

      {view === 'uploading' && <section className={styles.progressCard} id="upload-progress" aria-live="polite">
        <div className={styles.sectionHead}><span className={styles.step}><Icon name="upload" /></span><h2>{progress.phase === 'verifying' ? copy.progress.verifying : progress.phase === 'retrying' ? copy.progress.retrying : copy.progress.title}</h2></div>
        {file && <p className={styles.fileLine} dir="auto"><Icon name="film" /> {file.name}</p>}
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
        <div className={styles.progressMeta}>
          <strong>{percent}%</strong>
          <span>{copy.progress.of(formatBytes(progress.done, lang), formatBytes(progress.total, lang))}</span>
          {speedRef.current.speed > 0 && progress.phase === 'uploading' && !uploadFailure && <span>{formatBytes(speedRef.current.speed, lang)}/s</span>}
        </div>
        {!uploadFailure && <p className={styles.keepOpen}><Icon name="info" /> {copy.progress.keepOpen}</p>}
        {uploadFailure && error && <div className="form-error-banner" role="alert">{error}</div>}
        <div className={styles.actions}>
          {uploadFailure
            ? <>
              <button type="button" className={styles.primary} onClick={retryUpload} disabled={busy} id="retry-upload"><Icon name="refresh" /> {copy.actions.retry}</button>
              <button type="button" className={styles.ghost} onClick={() => { setUploadFailure(null); setError(''); setView('existing') }}>{copy.actions.back}</button>
            </>
            : <button type="button" className={styles.ghost} onClick={cancelUpload} disabled={progress.phase === 'verifying'} id="cancel-upload">{copy.actions.cancelUpload}</button>}
        </div>
      </section>}

      {view === 'done' && team && <section className={styles.receipt} id="submit-receipt">
        <div className={styles.successIcon}><Icon name="check" /></div>
        <h2>{copy.success.title}</h2>
        <p>{copy.success.text} <strong>{outcome === 'replaced' ? copy.success.replaced : copy.success.created}</strong></p>
        {renderTeamCard(team, true)}
        <p className={styles.keepCode}><Icon name="info" /> {copy.card.keepCode}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={copyCode} id="copy-code"><Icon name="copy" /> {copied ? copy.actions.copied : copy.actions.copyCode}</button>
          <a className={styles.whatsapp} href={whatsappShareUrl(receiptText(team, lang))} target="_blank" rel="noopener noreferrer" id="share-whatsapp"><Icon name="whatsapp" /> {copy.actions.whatsapp} <Icon name="external" /></a>
          <Link to="/tabsur" className={styles.ghost}>{copy.actions.home}</Link>
        </div>
      </section>}
    </div>
  </div>
}
