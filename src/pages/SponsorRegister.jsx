import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseActive, formatSupabaseError } from '../lib/supabase'
import BgParticles from '../components/BgParticles'
import { useRegisterAnimations, gsap } from '../lib/animations'
import styles from './Register.module.css'

function arabicToAscii(s) {
  return String(s)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
}

async function submitSponsor(payload) {
  if (!isSupabaseActive) {
    await new Promise(resolve => setTimeout(resolve, 800))
    return { ok: true, simulated: true }
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

async function sendSponsorEmail({ email, fullName }) {
  try {
    const response = await fetch('/api/send-registration-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fullName,
        kind: 'sponsor',
        origin: window.location.origin,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) {
      console.warn('Sponsor email was not sent:', data)
    }
  } catch (error) {
    console.warn('Sponsor email was not sent:', error)
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

  const [form, setForm] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    mobile: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    const nextValue = name === 'mobile'
      ? arabicToAscii(value).replace(/\D/g, '').slice(0, 10)
      : value

    setForm(current => ({ ...current, [name]: nextValue }))
    setErrors(current => ({ ...current, [name]: '' }))
    setFormError('')
  }

  function validate() {
    const nextErrors = {}
    const mobile = arabicToAscii(form.mobile).replace(/\D/g, '')

    if (!form.organizationName.trim() || form.organizationName.trim().length < 2) {
      nextErrors.organizationName = 'الرجاء كتابة اسم الجهة'
    }
    if (!form.contactName.trim() || form.contactName.trim().length < 2) {
      nextErrors.contactName = 'الرجاء كتابة اسم الشخص المسؤول'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'الرجاء كتابة بريد إلكتروني صحيح'
    }
    if (!/^05\d{8}$/.test(mobile)) {
      nextErrors.mobile = 'رقم غير صحيح — يجب أن يبدأ بـ 05 ويتكوّن من 10 أرقام'
    }

    return nextErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setFormError('')

    const mobile = arabicToAscii(form.mobile).replace(/\D/g, '')
    const result = await submitSponsor({
      organization_name: form.organizationName.trim(),
      contact_name: form.contactName.trim(),
      contact_email: form.email.trim(),
      contact_mobile: mobile,
      created_at: new Date().toISOString(),
    })

    setLoading(false)
    if (result.ok) {
      sendSponsorEmail({
        email: form.email,
        fullName: form.contactName,
      })
      gsap.to('.card-form-view', {
        opacity: 0,
        y: -12,
        duration: 0.45,
        ease: 'power2.in',
        onComplete: () => setSuccess(true),
      })
    } else if (result.duplicate) {
      setErrors({ email: 'هذا البريد مسجّل من قبل.' })
      setFormError('هذا البريد مسجّل من قبل — سنكتفي بطلبكم السابق.')
    } else {
      setFormError('تعذّر إرسال الطلب. تأكد من إعداد جدول sponsor_registrations في Supabase ثم حاول مرة أخرى.')
    }
  }

  return (
    <div className={`${styles.page} ${styles.sponsorPage}`}>
      <BgParticles />
      <nav className={styles.nav}>
        <Link className={styles.brand} to="/">
          <span className={styles.brandMark}><img src="/assets/tabsur-mark.png" alt="" /></span>
          <span className={styles.brandWord}>
            <span className={styles.ar}>معسكر تَبصِّر</span>
            <span className={styles.en}>SPONSOR REGISTRATION</span>
          </span>
        </Link>
        <Link className={styles.navBack} to="/#sponsors">
          <span>قسم الرعاة</span>
          <span className={styles.arrow}>→</span>
        </Link>
      </nav>

      <div className="proportion-strip" aria-hidden="true" style={{ height: '6px' }}>
        <span className="g" /><span className="c" /><span className="m" />
      </div>

      <main className={`${styles.shell} ${styles.sponsorShell}`}>
        <aside className={`${styles.intro} fade-up`}>
          <div className={styles.introEyebrow}>SPONSORS · TABSUR</div>
          <h1>تسجيل <span className={styles.accent}>الرعاة</span></h1>
          <p>هذا النموذج مخصص للجهات الراغبة في رعاية معسكر تَبصِّر أو التواصل حول فرص الشراكة والدعم.</p>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 18h16M6 18V9l6-4 6 4v9" />
                </svg>
              </span>
              <span><strong>بيانات مختصرة</strong> · اسم الجهة والشخص المسؤول فقط</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8 9.67a16 16 0 0 0 6.33 6.33l1.21-1.21a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span><strong>سنتواصل معكم</strong> لمناقشة باقات الرعاية المناسبة</span>
            </div>
          </div>
        </aside>

        <section className={`${styles.card} ${styles.sponsorCard} fade-up`}>
          {!success ? (
            <div className="card-form-view">
              <div className={styles.cardHead}>
                <h2>نموذج الرعاة</h2>
                <span className={styles.step}>SPONSOR · 01 / 01</span>
              </div>
              <p className={styles.cardSub}>الحقول التي تحمل <span style={{ color: 'var(--coral-500)' }}>•</span> مطلوبة.</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="field-row">
                  <Field id="organizationName" label="اسم الجهة" required invalid={!!errors.organizationName} error={errors.organizationName}>
                    <input className="input" id="organizationName" name="organizationName" type="text" value={form.organizationName} onChange={handleChange} placeholder="اسم الشركة أو الجهة" />
                  </Field>
                  <Field id="contactName" label="اسم الشخص المسؤول" required invalid={!!errors.contactName} error={errors.contactName}>
                    <input className="input" id="contactName" name="contactName" type="text" value={form.contactName} onChange={handleChange} placeholder="الاسم الكامل" autoComplete="name" />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="email" label="الإيميل" required invalid={!!errors.email} error={errors.email}>
                    <input className="input" id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@example.com" autoComplete="email" />
                  </Field>
                  <Field id="mobile" label="رقم الشخص المسؤول" required hint="يبدأ بـ 05 ويتكوّن من 10 أرقام" invalid={!!errors.mobile} error={errors.mobile}>
                    <div className="tel-group">
                      <span className="tel-prefix">+966</span>
                      <input id="mobile" name="mobile" type="tel" inputMode="numeric" maxLength={10} placeholder="05XXXXXXXX" value={form.mobile} onChange={handleChange} autoComplete="tel-national" />
                    </div>
                  </Field>
                </div>

                {formError && <div className="form-error-banner">{formError}</div>}

                <div className={styles.actions}>
                  <button className={`btn btn-primary ${loading ? styles.isLoading : ''}`} type="submit" disabled={loading}>
                    {loading && <span className={styles.spinner} />}
                    {loading ? 'جارٍ الإرسال...' : 'إرسال طلب الرعاية'}
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
              <h2 className={styles.successTitle}>وصل طلب الرعاية</h2>
              <p className={styles.successMsg}>شكرًا لكم. سنراجع بيانات الجهة ونتواصل مع الشخص المسؤول قريبًا لمناقشة فرص الرعاية.</p>
              <div className={styles.successActions}>
                <Link className="btn btn-primary" to="/">العودة للرئيسية</Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        TABSUR CAMP · SPONSOR REGISTRATION
      </footer>
    </div>
  )
}
