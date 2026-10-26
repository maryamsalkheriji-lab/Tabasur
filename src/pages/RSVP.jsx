import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseActive } from '../lib/supabase'
import { DEFAULT_RSVP_SLUG, normalizeGuestName, validateGuestName } from '../lib/rsvp'
import styles from './RSVP.module.css'

const COPY = {
  ar: {
    title: 'تأكيد الحضور | مدينة تك', brand: 'مدينة تك', loading: 'جارٍ تحميل الدعوة…',
    missing: 'رابط الدعوة غير متاح. تأكد من الرابط المرسل إليك.', loadFailed: 'تعذّر تحميل الدعوة. حاول مرة أخرى.',
    retry: 'إعادة المحاولة', attendingTitle: 'ننتظرك بكل ترحيب', declinedTitle: 'شكرًا لإبلاغنا',
    attendingReceipt: 'تم تأكيد حضورك بنجاح.', declinedReceipt: 'تم تسجيل اعتذارك عن الحضور.',
    edit: 'تعديل الرد', invitation: 'دعوة لحضور', heading: 'يسعدنا', emphasis: 'حضورك.',
    welcome: 'أهلًا بك، نتطلّع للقائك ومشاركتك هذه المناسبة.', name: 'الاسم', required: 'إلزامي',
    placeholder: 'اكتب اسمك الكامل', confirming: 'جارٍ التأكيد…', confirm: 'تأكيد الحضور',
    saving: 'جارٍ الحفظ…', decline: 'اعتذار عن الحضور', choiceRequired: 'اختر تأكيد الحضور أو الاعتذار.',
    saveFailed: 'تعذّر تأكيد حفظ ردّك. حاول مرة أخرى؛ لن يتكرر الرد عند إعادة المحاولة.',
  },
  en: {
    title: 'RSVP | Madinah Tech', brand: 'Madinah Tech', loading: 'Loading your invitation…',
    missing: 'This invitation is unavailable. Please check the link you received.', loadFailed: 'Unable to load your invitation. Please try again.',
    retry: 'Try again', attendingTitle: 'We look forward to seeing you', declinedTitle: 'Thank you for letting us know',
    attendingReceipt: 'Your attendance is confirmed.', declinedReceipt: 'Your response has been saved. We’re sorry you can’t join us.',
    edit: 'Edit response', invitation: 'You’re invited to', heading: 'We’d love to', emphasis: 'see you.',
    welcome: 'Welcome! We look forward to sharing this occasion with you.', name: 'Full name', required: 'Required',
    placeholder: 'Enter your full name', confirming: 'Confirming…', confirm: 'Confirm attendance',
    saving: 'Saving…', decline: 'Unable to attend', choiceRequired: 'Please confirm your attendance or let us know you can’t attend.',
    saveFailed: 'We couldn’t confirm that your response was saved. Please try again; retrying won’t create a duplicate.',
  },
}

export default function RSVP() {
  const { slug = DEFAULT_RSVP_SLUG } = useParams()
  return <Invitation key={slug} slug={slug} />
}

function Invitation({ slug }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const language = searchParams.get('lang') === 'en' ? 'en' : 'ar'
  const copy = COPY[language]
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [saved, setSaved] = useState(null)
  const submitting = useRef(false)
  const responseId = useRef(null)
  const nameInput = useRef(null)
  const success = useRef(null)
  const storageKey = `cubex-rsvp:${slug}`
  const eventName = language === 'en' && slug === DEFAULT_RSVP_SLUG ? 'Madinah Tech' : event?.name
  const errorMessage = error === 'name' ? validateGuestName(name, language) : copy[error]

  function switchLanguage() {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('lang', language === 'en' ? 'ar' : 'en')
      return next
    })
  }

  useLayoutEffect(() => {
    const title = document.title
    const previousLanguage = document.documentElement.lang
    const previousDirection = document.documentElement.dir
    document.title = copy.title
    document.documentElement.lang = language
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl'
    return () => {
      document.title = title
      document.documentElement.lang = previousLanguage
      document.documentElement.dir = previousDirection
    }
  }, [language, copy.title])

  useEffect(() => {
    try {
      const previous = JSON.parse(sessionStorage.getItem(storageKey))
      if (previous?.id && previous?.name && ['attending', 'declined'].includes(previous.status)) {
        responseId.current = previous.id
        setName(previous.name)
        setSaved(previous)
      }
    } catch { /* The form also works without browser storage. */ }
  }, [storageKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    async function load() {
      try {
        if (!isSupabaseActive) throw new Error('unavailable')
        const { data, error: err } = await supabase.from('jd_events').select('id,name,slug').eq('slug', slug).maybeSingle()
        if (err) throw err
        if (!active) return
        if (!data) setLoadError('missing')
        else setEvent(data)
      } catch {
        if (active) setLoadError('loadFailed')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [slug, attempt])

  useEffect(() => {
    if (saved && !loading && !loadError) success.current?.focus({ preventScroll: true })
  }, [saved, loading, loadError])

  async function submit(e) {
    e.preventDefault()
    if (submitting.current || !event) return
    const status = e.nativeEvent.submitter?.value
    const invalid = validateGuestName(name)
    if (invalid) { setError('name'); nameInput.current?.focus(); return }
    if (!['attending', 'declined'].includes(status)) { setError('choiceRequired'); return }
    submitting.current = true
    setBusy(status)
    setError('')
    try {
      // Keep the same ID on retry: a lost network response must not duplicate a guest.
      if (!responseId.current) responseId.current = crypto.randomUUID()
      const fullName = normalizeGuestName(name)
      const { error: err } = await supabase.rpc('jd_submit_rsvp', {
        p_slug: slug, p_response_id: responseId.current, p_name: fullName, p_status: status,
      })
      if (err) throw err
      const receipt = { id: responseId.current, name: fullName, status }
      try { sessionStorage.setItem(storageKey, JSON.stringify(receipt)) } catch { /* optional */ }
      setSaved(receipt)
    } catch {
      setError('saveFailed')
    } finally {
      submitting.current = false
      setBusy('')
    }
  }

  return (
    <main className={styles.page} dir={language === 'en' ? 'ltr' : 'rtl'} lang={language}>
      <button className={styles.language} type="button" onClick={switchLanguage} lang={language === 'en' ? 'ar' : 'en'}>
        {language === 'en' ? 'العربية' : 'English'}
      </button>
      <div className={styles.decoration} aria-hidden="true">
        <div className={styles.pattern}><span /><span /></div>
      </div>
      <section className={styles.invitation} aria-labelledby="rsvp-title">
        <img className={styles.logo} src="/assets/rsvp/madinah-tech-white.png" alt={copy.brand} />
        {loading ? <p className={styles.status} role="status">{copy.loading}</p> : loadError ? (
          <div className={styles.status}>
            <p role="alert">{copy[loadError]}</p>
            <button className={styles.edit} onClick={() => setAttempt(n => n + 1)}>{copy.retry}</button>
          </div>
        ) : saved ? (
          <div className={styles.receipt} ref={success} tabIndex={-1} role="status">
            <span className={styles.receiptIcon} aria-hidden="true">✓</span>
            <h1 id="rsvp-title">{saved.status === 'attending' ? copy.attendingTitle : copy.declinedTitle}</h1>
            <p><bdi>{saved.name}</bdi>{language === 'en' ? ', ' : '، '}{saved.status === 'attending' ? copy.attendingReceipt : copy.declinedReceipt}</p>
            <button className={styles.edit} onClick={() => { setSaved(null); setError('') }}>{copy.edit}</button>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>{copy.invitation} <bdi>{eventName}</bdi></p>
            <h1 id="rsvp-title">{copy.heading} <span>{copy.emphasis}</span></h1>
            <p className={styles.welcome}>{copy.welcome}</p>
            <form className={styles.form} onSubmit={submit} noValidate aria-busy={Boolean(busy)}>
              <label htmlFor="rsvp-name">{copy.name} <span>{copy.required}</span></label>
              <input ref={nameInput} id="rsvp-name" name="name" type="text" autoComplete="name" required maxLength={120}
                placeholder={copy.placeholder} value={name} disabled={Boolean(busy)} dir="auto"
                onChange={e => { setName(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'rsvp-error' : undefined} />
              {error && <p id="rsvp-error" className={styles.error} role="alert">{errorMessage}</p>}
              <div className={styles.actions}>
                <button type="submit" value="attending" disabled={Boolean(busy)} className={styles.confirm}>
                  <span aria-hidden="true">✓</span>{busy === 'attending' ? copy.confirming : copy.confirm}
                </button>
                <button type="submit" value="declined" disabled={Boolean(busy)} className={styles.decline}>
                  {busy === 'declined' ? copy.saving : copy.decline}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
