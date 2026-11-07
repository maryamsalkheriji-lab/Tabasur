import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseActive, formatSupabaseError } from '../lib/supabase'
import { DEFAULT_COUNTRY, validateMobile } from '../lib/phone'
import { useLanguage } from '../lib/language'
import BgParticles from '../components/BgParticles'
import LanguageToggle from '../components/LanguageToggle'
import PhoneInput from '../components/PhoneInput'
import RegistrationEmailStatus from '../components/RegistrationEmailStatus'
import { useRegisterAnimations, gsap } from '../lib/animations'
import styles from './Register.module.css'

async function submitSponsor(payload) {
  if (!isSupabaseActive) {
    return { ok: false, unavailable: true }
  }

  try {
    const { error } = await supabase
      .from('sponsor_registrations')
      .insert([payload])

    if (!error) return { ok: true }
    if (error.code === '23505' || /duplicate/i.test(error.message || '')) {
      return { ok: false, duplicate: true }
    }
    return { ok: false, message: formatSupabaseError(error) }
  } catch (error) {
    return { ok: false, message: formatSupabaseError(error) }
  }
}


function Field({ id, label, required, hint, error, invalid, children }) {
  return (
    <div className={`field ${invalid ? 'is-invalid' : ''}`}>
      <label htmlFor={id}>
        {label}{required && <span className="req">•</span>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}

export default function SponsorRegister() {
  useRegisterAnimations()
  const { t, lang } = useLanguage()
  const s = t.sponsor
  const f = s.fields
  // Validation stores message keys so the text follows the chosen language.
  const te = key => (key ? s.errors[key] || key : '')

  const [form, setForm] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    country: DEFAULT_COUNTRY,
    mobile: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)
  const submitting = useRef(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: '' }))
    setFormError('')
  }

  // حقل الجوال الدولي يرسل الدولة والرقم معًا
  function handlePhone({ country, number }) {
    setForm(current => ({ ...current, country, mobile: number }))
    setErrors(current => ({ ...current, mobile: '' }))
    setFormError('')
  }

  function validate() {
    const nextErrors = {}
    const phone = validateMobile(form.country, form.mobile)

    if (!form.organizationName.trim() || form.organizationName.trim().length < 2) {
      nextErrors.organizationName = 'organizationRequired'
    } else if (form.organizationName.trim().length > 200) {
      nextErrors.organizationName = 'organizationLong'
    }
    if (!form.contactName.trim() || form.contactName.trim().length < 2) {
      nextErrors.contactName = 'contactRequired'
    } else if (form.contactName.trim().length > 100) {
      nextErrors.contactName = 'contactLong'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254) {
      nextErrors.email = 'email'
    }
    if (!phone.ok) {
      nextErrors.mobile = phone.reason
    }

    return nextErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting.current) return
    const nextErrors = validate()
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    submitting.current = true
    setLoading(true)
    setFormError('')

    const result = await submitSponsor({
      organization_name: form.organizationName.trim(),
      contact_name: form.contactName.trim(),
      contact_email: form.email.trim(),
      contact_mobile: validateMobile(form.country, form.mobile).stored,
      created_at: new Date().toISOString(),
    })

    if (result.ok) {
      gsap.to('.card-form-view', {
        opacity: 0,
        y: -12,
        duration: 0.45,
        ease: 'power2.in',
        onComplete: () => {
          setSuccess(true)
          setLoading(false)
          window.scrollTo({ top: 0, behavior: 'instant' })
        },
      })
      return
    }
    submitting.current = false
    setLoading(false)
    if (result.duplicate) {
      setErrors({ email: 'duplicateEmail' })
      setFormError('duplicate')
    } else if (result.unavailable) {
      setFormError('unavailable')
    } else {
      setFormError('failed')
    }
  }

  return (
    <div className={`${styles.page} ${styles.sponsorPage}`}>
      <BgParticles />
      <nav className={styles.nav}>
        <Link className={styles.brand} to="/tabsur">
          <span className={styles.brandMark}><img src="/assets/tabsur-mark.png" alt="" /></span>
          <span className={styles.brandWord}>
            <span className={styles.ar}>{s.brandBig}</span>
            <span className={styles.en}>{s.brandSmall}</span>
          </span>
        </Link>
        <div className={styles.navActions}>
          <LanguageToggle />
          <Link className={styles.navBack} to="/tabsur#sponsors">
            <span>{s.back}</span>
            <span className={styles.arrow}>{lang === 'en' ? '←' : '→'}</span>
          </Link>
        </div>
      </nav>

      <div className="proportion-strip" aria-hidden="true" style={{ height: '6px' }}>
        <span className="g" /><span className="c" /><span className="m" />
      </div>

      <main className={`${styles.shell} ${styles.sponsorShell}`}>
        <aside className={`${styles.intro} fade-up`}>
          <div className={styles.introEyebrow}>{s.eyebrow}</div>
          <h1>{s.titlePrefix}<span className={styles.accent}>{s.titleAccent}</span></h1>
          <p>{s.intro}</p>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 18h16M6 18V9l6-4 6 4v9" />
                </svg>
              </span>
              <span><strong>{s.meta.brief}</strong>{s.meta.briefRest}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8 9.67a16 16 0 0 0 6.33 6.33l1.21-1.21a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span><strong>{s.meta.contact}</strong>{s.meta.contactRest}</span>
            </div>
          </div>
          {!isSupabaseActive && (
            <div className={styles.supabaseHint} role="status">
              {s.unavailable}
            </div>
          )}
        </aside>

        <section className={`${styles.card} ${styles.sponsorCard} fade-up`}>
          {!success ? (
            <div className="card-form-view">
              <div className={styles.cardHead}>
                <h2>{s.formTitle}</h2>
                <span className={styles.step}>{s.step}</span>
              </div>
              <p className={styles.cardSub}>{s.requiredPrefix}<span style={{ color: 'var(--coral-500)' }}>•</span>{s.requiredSuffix}</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="field-row">
                  <Field id="organizationName" label={f.organizationName.label} required invalid={!!errors.organizationName} error={te(errors.organizationName)}>
                    <input className="input" id="organizationName" name="organizationName" type="text" value={form.organizationName} onChange={handleChange} placeholder={f.organizationName.placeholder} />
                  </Field>
                  <Field id="contactName" label={f.contactName.label} required invalid={!!errors.contactName} error={te(errors.contactName)}>
                    <input className="input" id="contactName" name="contactName" type="text" value={form.contactName} onChange={handleChange} placeholder={f.contactName.placeholder} autoComplete="name" />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="email" label={f.email.label} required invalid={!!errors.email} error={te(errors.email)}>
                    <input className="input" id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@example.com" autoComplete="email" />
                  </Field>
                  <Field id="mobile" label={f.mobile.label} required hint={form.country === 'SA' ? f.mobile.hint : f.mobile.hintIntl} invalid={!!errors.mobile} error={te(errors.mobile)}>
                    <PhoneInput id="mobile" name="mobile" lang={lang} labels={t.phone} country={form.country} number={form.mobile} onChange={handlePhone} />
                  </Field>
                </div>

                {formError && <div className="form-error-banner">{s.formErrors[formError] || formError}</div>}

                <div className={styles.actions}>
                  <button className={`btn btn-primary ${loading ? styles.isLoading : ''}`} type="submit" disabled={loading || !isSupabaseActive}>
                    {loading && <span className={styles.spinner} />}
                    {loading ? s.sending : s.submit}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className={styles.success}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className={styles.successTitle}>{s.success.title}</h2>
              <p className={styles.successMsg}>{s.success.msg}</p>
              <RegistrationEmailStatus email={form.email.trim()} fullName={form.contactName.trim()} kind="sponsor" />
              <div className={styles.successActions}>
                <Link className="btn btn-primary" to="/tabsur">{s.success.home}</Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        {s.footer}
      </footer>
    </div>
  )
}
