import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseActive, formatSupabaseError } from '../lib/supabase'
import { isHttpUrl } from '../lib/security'
import { DEFAULT_COUNTRY, validateMobile } from '../lib/phone'
import { useLanguage } from '../lib/language'
import BgParticles from '../components/BgParticles'
import LanguageToggle from '../components/LanguageToggle'
import PhoneInput from '../components/PhoneInput'
import RegistrationEmailStatus from '../components/RegistrationEmailStatus'
import { useRegisterAnimations, gsap } from '../lib/animations'
import styles from './Register.module.css'

/* ─── helpers ─── */
function makeReceipt() {
  return 'TBSR-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000)
}

async function submitToSupabase(payload) {
  if (!isSupabaseActive) {
    return { ok: false, unavailable: true }
  }
  try {
    const { error } = await supabase
      .from('registrations')
      .insert([payload])
    if (!error) return { ok: true }
    if (error.code === '23505' || /duplicate/i.test(error.message || '')) {
      return { ok: false, duplicate: true }
    }
    return { ok: false, message: formatSupabaseError(error) }
  } catch (e) {
    return { ok: false, message: formatSupabaseError(e) }
  }
}


/* ─── Field wrapper ─── */
function Field({ id, label, required, hint, error, invalid, children }) {
  return (
    <div className={`field ${invalid ? 'is-invalid' : ''}`}>
      {label && (
        <label htmlFor={id}>
          {label}{required && <span className="req">•</span>}
        </label>
      )}
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}

/* ─── Main Register component ─── */
export default function Register() {
  useRegisterAnimations()
  const { t, lang } = useLanguage()
  const r = t.register
  const f = r.fields
  // Validation stores message keys so the text follows the chosen language.
  const te = key => (key ? r.errors[key] || key : '')

  const [form, setForm] = useState({
    fullName: '', city: '', country: DEFAULT_COUNTRY, mobile: '', email: '',
    specialty: '', experience: '', aiExperience: '', portfolio: '', socialAccount: '', notes: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)
  const submitting = useRef(false)
  const [receiptId, setReceiptId] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(err => ({ ...err, [name]: '' }))
    setFormError('')
  }

  // حقل الجوال الدولي يرسل الدولة والرقم معًا
  function handlePhone({ country, number }) {
    setForm(f => ({ ...f, country, mobile: number }))
    setErrors(err => ({ ...err, mobile: '' }))
    setFormError('')
  }

  function validate() {
    const errs = {}
    // اسم كامل — إجباري
    if (!form.fullName || form.fullName.trim().length < 2)
      errs.fullName = 'fullNameRequired'
    else if (form.fullName.trim().length > 100)
      errs.fullName = 'fullNameLong'
    // جوال — إجباري، من أي دولة (السعودية بصيغة 05، والبقية بالصيغة الدولية)
    const phone = validateMobile(form.country, form.mobile)
    if (!phone.ok)
      errs.mobile = phone.reason
    // بريد — إجباري
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254)
      errs.email = 'email'
    // المدينة — اختيارية
    if (form.city && form.city.trim().length > 100)
      errs.city = 'cityLong'
    // تخصص — إجباري
    if (!form.specialty)
      errs.specialty = 'specialty'
    // سنوات الخبرة — إجبارية
    if (!form.experience)
      errs.experience = 'experience'
    // أدوات AI — إجبارية
    if (!form.aiExperience)
      errs.aiExperience = 'aiExperience'
    // رابط الأعمال — إجباري
    if (!form.portfolio || !form.portfolio.trim()) {
      errs.portfolio = 'portfolioRequired'
    } else if (!isHttpUrl(form.portfolio) || form.portfolio.trim().length > 500) {
      errs.portfolio = 'portfolioInvalid'
    }
    // رابط الحساب — اختياري، لكن إذا أُدخل يجب أن يكون صحيحاً
    if (form.socialAccount && form.socialAccount.trim()) {
      if (!isHttpUrl(form.socialAccount) || form.socialAccount.trim().length > 500)
        errs.socialAccount = 'socialInvalid'
    }
    // دافع الانضمام — إجباري
    if (!form.notes || form.notes.trim().length < 10)
      errs.notes = 'notesShort'
    else if (form.notes.trim().length > 2000)
      errs.notes = 'notesLong'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting.current) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    submitting.current = true
    setLoading(true)
    setFormError('')

    const result = await submitToSupabase({
      full_name:  form.fullName.trim(),
      email:      form.email.trim(),
      mobile:     validateMobile(form.country, form.mobile).stored,
      city:       form.city.trim() || null,
      specialty:     form.specialty,
      experience:    form.experience || null,
      ai_experience: form.aiExperience || null,
      portfolio:     form.portfolio.trim() || null,
      social_account: form.socialAccount.trim() || null,
      notes:      form.notes.trim(),
      created_at: new Date().toISOString()
    })

    if (result.ok) {
      const nextReceiptId = makeReceipt()
      setReceiptId(nextReceiptId)

      gsap.to('.card-form-view', {
        opacity: 0, y: -12, duration: 0.5, ease: 'power2.in',
        onComplete: () => {
          setSuccess(true)
          setLoading(false)
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
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

  function resetForm() {
    submitting.current = false
    setForm({ fullName:'', city:'', country: DEFAULT_COUNTRY, mobile:'', email:'', specialty:'', experience:'', aiExperience:'', portfolio:'', socialAccount:'', notes:'' })
    setErrors({})
    setFormError('')
    setSuccess(false)
  }

  return (
    <div className={`${styles.page} ${styles.participantPage}`}>
      <BgParticles />
      {/* ─── Nav ─── */}
      <nav className={styles.nav}>
        <Link className={styles.brand} to="/tabsur">
          <span className={styles.brandMark}><img src="/assets/tabsur-mark.png" alt="" /></span>
          <span className={styles.brandWord}>
            <span className={styles.ar}>{r.brandBig}</span>
            <span className={styles.en}>{r.brandSmall}</span>
          </span>
        </Link>
        <div className={styles.navActions}>
          <LanguageToggle />
          <Link className={styles.navBack} to="/tabsur">
            <span>{r.back}</span>
            <span className={styles.arrow}>{lang === 'en' ? '←' : '→'}</span>
          </Link>
        </div>
      </nav>

      <div className="proportion-strip" aria-hidden="true" style={{ height:'6px' }}>
        <span className="g" /><span className="c" /><span className="m" />
      </div>

      <main className={styles.shell}>
        {/* ─── Intro ─── */}
        <aside className={`${styles.intro} fade-up`}>
          <div className={styles.introEyebrow}>{r.eyebrow}</div>
          <h1>{r.titlePrefix}<span className={styles.accent}>{r.titleAccent}</span></h1>
          <div className={styles.registrationNotice}>
            <strong>{r.notice.title}</strong>
            <p>{r.notice.text}</p>
          </div>
          <p>{r.intro}</p>

          <div className={styles.meta}>
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></svg>, text: <><strong>{r.meta.location}</strong>{r.meta.locationRest}</> },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-6-6L3 21"/></svg>, text: <><strong>{r.meta.library}</strong>{r.meta.libraryRest}</> },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg>, text: <><strong>{r.meta.submission}</strong>{r.meta.submissionRest}</> },
            ].map((row, i) => (
              <div key={i} className={styles.metaRow}>
                <span className={styles.metaIcon}>{row.icon}</span>
                <span>{row.text}</span>
              </div>
            ))}
          </div>

          {/* حالة Supabase */}
          {!isSupabaseActive && (
            <div className={styles.supabaseHint}>
              {r.unavailable}
            </div>
          )}
        </aside>

        {/* ─── Form card ─── */}
        <section className={`${styles.card} fade-up`}>
          {!success ? (
            <div className="card-form-view">
              <div className={styles.cardHead}>
                <h2>{r.formTitle}</h2>
                <span className={styles.step}>{r.step}</span>
              </div>
              <p className={styles.cardSub}>{r.requiredPrefix}<span style={{ color:'var(--coral-500)' }}>•</span>{r.requiredSuffix}</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="field-row">
                  <Field id="fullName" label={f.fullName.label} required invalid={!!errors.fullName} error={te(errors.fullName)}>
                    <input className="input" id="fullName" name="fullName" type="text"
                      placeholder={f.fullName.placeholder} autoComplete="name" required
                      value={form.fullName} onChange={handleChange} />
                  </Field>
                  <Field id="city" label={f.city.label} invalid={!!errors.city} error={te(errors.city)}>
                    <input className="input" id="city" name="city" type="text"
                      placeholder={f.city.placeholder}
                      value={form.city} onChange={handleChange} />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="mobile" label={f.mobile.label} required
                    hint={form.country === 'SA' ? f.mobile.hint : f.mobile.hintIntl}
                    invalid={!!errors.mobile} error={te(errors.mobile)}>
                    <PhoneInput id="mobile" name="mobile" lang={lang} labels={t.phone}
                      country={form.country} number={form.mobile} onChange={handlePhone} />
                  </Field>

                  <Field id="email" label={f.email.label} required invalid={!!errors.email} error={te(errors.email)}>
                    <input className="input" id="email" name="email" type="email"
                      placeholder="name@example.com" autoComplete="email"
                      value={form.email} onChange={handleChange} />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="specialty" label={f.specialty.label} required invalid={!!errors.specialty} error={te(errors.specialty)}>
                    <select className="select" id="specialty" name="specialty" required
                      value={form.specialty} onChange={handleChange}>
                      <option value="" disabled>{f.specialty.placeholder}</option>
                      {Object.entries(f.specialty.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field id="experience" label={f.experience.label} required invalid={!!errors.experience} error={te(errors.experience)}>
                    <select className="select" id="experience" name="experience"
                      value={form.experience} onChange={handleChange}>
                      <option value="" disabled>{f.experience.placeholder}</option>
                      {Object.entries(f.experience.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                </div>

                <Field id="aiExperience" label={f.aiExperience.label} required
                  hint={f.aiExperience.hint}
                  invalid={!!errors.aiExperience} error={te('aiExperience')}>
                  <div style={{display:'flex', gap:'12px', marginTop:'4px'}}>
                    {Object.entries(f.aiExperience.options).map(([value, label]) => (
                      <label key={value} style={{
                        flex:1, display:'flex', alignItems:'center', gap:'10px', cursor:'pointer',
                        padding:'12px 16px', borderRadius:'12px', border:'1.5px solid',
                        borderColor: form.aiExperience === value ? 'var(--green-500)' : 'var(--ink-200)',
                        background: form.aiExperience === value ? 'var(--green-50)' : 'var(--paper-tint)',
                        transition:'all .2s ease', fontSize:'14px', fontWeight: form.aiExperience === value ? 600 : 400,
                        color: form.aiExperience === value ? 'var(--green-700)' : 'var(--ink-700)',
                      }}>
                        <input type="radio" name="aiExperience" value={value}
                          checked={form.aiExperience === value}
                          onChange={handleChange}
                          style={{accentColor:'var(--green-500)', width:'16px', height:'16px'}} />
                        {label}
                      </label>
                    ))}
                  </div>
                </Field>

                <div className="field-row">
                <Field id="portfolio" label={f.portfolio.label} required
                  hint={f.portfolio.hint}
                  invalid={!!errors.portfolio} error={te(errors.portfolio)}>
                  <input className="input" id="portfolio" name="portfolio" type="url"
                    placeholder="https://behance.net/yourname"
                    value={form.portfolio} onChange={handleChange} />
                </Field>

                <Field id="socialAccount" label={f.socialAccount.label}
                  hint={f.socialAccount.hint}
                  invalid={!!errors.socialAccount} error={te(errors.socialAccount)}>
                  <input className="input" id="socialAccount" name="socialAccount" type="url"
                    placeholder="https://instagram.com/yourname"
                    value={form.socialAccount} onChange={handleChange} />
                </Field>
                </div>

                <Field id="notes" label={f.notes.label} required invalid={!!errors.notes} error={te(errors.notes === 'notesLong' ? 'notesLong' : 'notesRequired')}>
                  <textarea id="notes" name="notes" rows={4}
                    placeholder={f.notes.placeholder}
                    value={form.notes} onChange={handleChange} />
                </Field>

                {formError && <div className="form-error-banner">{r.formErrors[formError] || formError}</div>}

                <div className={styles.actions}>
                  <button type="submit" className={`btn btn-primary ${loading ? styles.isLoading : ''}`}
                    disabled={loading || !isSupabaseActive}>
                    {loading && <span className={styles.spinner} aria-hidden="true" />}
                    <span>{r.submit}</span>
                    {!loading && <span className="arrow">→</span>}
                  </button>
                  <p className={styles.tos}>
                    {r.tos}
                  </p>
                </div>
              </form>
            </div>
          ) : (
            <div className={styles.success}>

              {/* أيقونة النجاح */}
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>

              {/* العنوان */}
              <h3 className={styles.successTitle}>{r.success.title}</h3>

              {/* النص */}
              <p className={styles.successMsg}>
                {r.success.msgPrefix}<strong>{r.success.msgBrand}</strong>{r.success.msgSuffix}
              </p>

              <RegistrationEmailStatus email={form.email.trim()} fullName={form.fullName.trim()} receiptId={receiptId} kind="participant" />

              {/* كلام محفّز */}
              <div className={styles.successQuote}>
                <span className={styles.quoteIcon}>"</span>
                <p>{r.success.quote}</p>
                <span className={styles.quoteIcon}>"</span>
              </div>

              {/* رقم الطلب */}
              <div className={styles.receipt}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
                {r.success.receipt}<strong>{receiptId}</strong>
              </div>

              {/* الأزرار */}
              <div className={styles.successActions}>
                <Link className="btn btn-primary" to="/tabsur/remote">
                  <span>{r.success.online}</span>
                  <span className="arrow">→</span>
                </Link>
                <Link className="btn btn-ghost" to="/tabsur">
                  {r.success.home}
                </Link>
                <button className="btn btn-ghost" onClick={resetForm} type="button">
                  {r.success.another}
                </button>
              </div>

            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        {r.footer}
      </footer>
    </div>
  )
}
