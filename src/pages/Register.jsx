import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseActive } from '../lib/supabase'
import BgParticles from '../components/BgParticles'
import { useRegisterAnimations, gsap } from '../lib/animations'
import styles from './Register.module.css'

/* ─── helpers ─── */
function arabicToAscii(s) {
  return String(s)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
}

function makeReceipt() {
  return 'TBSR-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000)
}

async function submitToSupabase(payload) {
  if (!isSupabaseActive) {
    // ⚠️ وضع المحاكاة — يعمل حتى بدون Supabase مربوط
    await new Promise(r => setTimeout(r, 900))
    return { ok: true, simulated: true }
  }
  try {
    const { error } = await supabase
      .from('registrations')
      .insert([payload])
    if (!error) return { ok: true }
    if (error.code === '23505' || /duplicate/i.test(error.message || '')) {
      return { ok: false, duplicate: true }
    }
    return { ok: false, message: error.message || 'خطأ في الخادم' }
  } catch (e) {
    return { ok: false, message: 'تعذّر الاتصال بالخادم — تحقّق من اتصالك بالإنترنت' }
  }
}

async function sendRegistrationEmail({ email, fullName, receiptId }) {
  try {
    const response = await fetch('/api/send-registration-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fullName,
        receiptId,
        kind: 'participant',
        origin: window.location.origin,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) {
      console.warn('Registration email was not sent:', data)
    }
  } catch (error) {
    console.warn('Registration email was not sent:', error)
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

  const [form, setForm] = useState({
    fullName: '', city: '', mobile: '', email: '',
    specialty: '', experience: '', aiExperience: '', portfolio: '', socialAccount: '', notes: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)
  const [receiptId, setReceiptId] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    let v = value
    if (name === 'mobile') {
      v = arabicToAscii(value).replace(/\D/g, '').slice(0, 10)
    }
    setForm(f => ({ ...f, [name]: v }))
    setErrors(err => ({ ...err, [name]: '' }))
    setFormError('')
  }

  function validate() {
    const errs = {}
    // اسم كامل — إجباري
    if (!form.fullName || form.fullName.trim().length < 2)
      errs.fullName = 'الرجاء كتابة الاسم كاملًا'
    // جوال — إجباري
    const mobile = arabicToAscii(form.mobile).replace(/\D/g, '')
    if (!/^05\d{8}$/.test(mobile))
      errs.mobile = 'رقم غير صحيح — يجب أن يبدأ بـ 05 ويتكوّن من ١٠ أرقام'
    // بريد — إجباري
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'الرجاء كتابة بريد إلكتروني صحيح'
    // تخصص — إجباري
    if (!form.specialty)
      errs.specialty = 'الرجاء اختيار تخصّصك'
    // سنوات الخبرة — إجبارية
    if (!form.experience)
      errs.experience = 'الرجاء اختيار سنوات خبرتك'
    // أدوات AI — إجبارية
    if (!form.aiExperience)
      errs.aiExperience = 'الرجاء اختيار إجابة'
    // رابط الأعمال — إجباري
    if (!form.portfolio || !form.portfolio.trim()) {
      errs.portfolio = 'الرجاء إدخال رابط أعمالك'
    } else {
      try { new URL(form.portfolio) } catch (_) {
        errs.portfolio = 'الرجاء إدخال رابط أعمال صحيح يبدأ بـ https://'
      }
    }
    // رابط الحساب — اختياري، لكن إذا أُدخل يجب أن يكون صحيحاً
    if (form.socialAccount && form.socialAccount.trim()) {
      try { new URL(form.socialAccount) } catch (_) {
        errs.socialAccount = 'الرجاء إدخال رابط حساب صحيح يبدأ بـ https://'
      }
    }
    // دافع الانضمام — إجباري
    if (!form.notes || form.notes.trim().length < 10)
      errs.notes = 'الرجاء كتابة دافعك للانضمام (١٠ أحرف على الأقل)'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setFormError('')

    const mobile = arabicToAscii(form.mobile).replace(/\D/g, '')
    const result = await submitToSupabase({
      full_name:  form.fullName,
      email:      form.email,
      mobile,
      city:       form.city || null,
      specialty:     form.specialty,
      experience:    form.experience || null,
      ai_experience: form.aiExperience || null,
      portfolio:     form.portfolio || null,
      social_account: form.socialAccount || null,
      notes:      form.notes,
      created_at: new Date().toISOString()
    })

    setLoading(false)
    if (result.ok) {
      const nextReceiptId = makeReceipt()
      setReceiptId(nextReceiptId)
      sendRegistrationEmail({
        email: form.email,
        fullName: form.fullName,
        receiptId: nextReceiptId,
      })
      gsap.to('.card-form-view', {
        opacity: 0, y: -12, duration: 0.5, ease: 'power2.in',
        onComplete: () => setSuccess(true)
      })
    } else if (result.duplicate) {
      setErrors({ email: 'هذا البريد مسجّل من قبل.' })
      setFormError('هذا البريد مسجّل من قبل — إن كنت سجّلت سابقًا فلا داعي للتكرار.')
    } else {
      setFormError('تعذّر إرسال طلبك، قد يكون الاتصال منقطعاً. انتظر دقيقتين ثم حاول مرة أخرى.')
    }
  }

  function resetForm() {
    setForm({ fullName:'', city:'', mobile:'', email:'', specialty:'', experience:'', aiExperience:'', portfolio:'', socialAccount:'', notes:'' })
    setErrors({})
    setFormError('')
    setSuccess(false)
  }

  return (
    <div className={styles.page}>
      <BgParticles />
      {/* ─── Nav ─── */}
      <nav className={styles.nav}>
        <Link className={styles.brand} to="/">
          <span className={styles.brandMark}><img src="/assets/tabsur-mark.png" alt="" /></span>
          <span className={styles.brandWord}>
            <span className={styles.ar}>تَبصَّر</span>
            <span className={styles.en}>TABSUR · INSIGHT</span>
          </span>
        </Link>
        <Link className={styles.navBack} to="/">
          <span>الصفحة الرئيسية</span>
          <span className={styles.arrow}>→</span>
        </Link>
      </nav>

      <div className="proportion-strip" aria-hidden="true" style={{ height:'6px' }}>
        <span className="g" /><span className="c" /><span className="m" />
      </div>

      <main className={styles.shell}>
        {/* ─── Intro ─── */}
        <aside className={`${styles.intro} fade-up`}>
          <div className={styles.introEyebrow}>التسجيل · دفعة ٢٠٢٦</div>
          <h1>انضمّ إلى <span className={styles.accent}>تَبصَّر</span></h1>
          <p>ثلاثون مقعدًا فقط، نختار من خلالها أصواتًا بصريّة جديدة لتوثيق المدينة المنورة. أكمل النموذج، وسنتواصل معك خلال أسبوع.</p>

          <div className={styles.meta}>
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2C7.5 2 4 5.5 4 10c0 6 8 12 8 12s8-6 8-12c0-4.5-3.5-8-8-8z"/><circle cx="12" cy="10" r="3"/></svg>, text: <><strong>المدينة المنورة</strong> · المملكة العربية السعودية</> },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>, text: <><strong>١٢ – ١٥ شعبان ١٤٤٧ هـ</strong> · أربعة أيام</> },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>, text: <><strong>التسجيل مفتوح</strong> حتى ١٥ رجب ١٤٤٧ هـ</> },
            ].map((r, i) => (
              <div key={i} className={styles.metaRow}>
                <span className={styles.metaIcon}>{r.icon}</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>

          {/* حالة Supabase */}
          {!isSupabaseActive && (
            <div className={styles.supabaseHint}>
              ⚠️ <strong>وضع المحاكاة:</strong> الإرسال يعمل لكن البيانات لا تُحفظ. أضف بيانات Supabase في ملف <code>.env</code> لتفعيل الحفظ الفعلي.
            </div>
          )}
        </aside>

        {/* ─── Form card ─── */}
        <section className={`${styles.card} fade-up`}>
          {!success ? (
            <div className="card-form-view">
              <div className={styles.cardHead}>
                <h2>نموذج التسجيل</h2>
                <span className={styles.step}>FORM · 01 / 01</span>
              </div>
              <p className={styles.cardSub}>الحقول التي تحمل <span style={{ color:'var(--coral-500)' }}>•</span> مطلوبة. اقرأها بهدوء قبل الإرسال.</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="field-row">
                  <Field id="fullName" label="الاسم الكامل" required invalid={!!errors.fullName} error={errors.fullName}>
                    <input className="input" id="fullName" name="fullName" type="text"
                      placeholder="اكتب اسمك ثلاثيًا" autoComplete="name" required
                      value={form.fullName} onChange={handleChange} />
                  </Field>
                  <Field id="city" label="المدينة">
                    <input className="input" id="city" name="city" type="text"
                      placeholder="المدينة المنورة، الرياض، ..."
                      value={form.city} onChange={handleChange} />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="mobile" label="رقم الجوال" required
                    hint="يبدأ بـ 05 ويتكوّن من ١٠ أرقام"
                    invalid={!!errors.mobile} error={errors.mobile}>
                    <div className="tel-group">
                      <span className="tel-prefix">🇸🇦 +966</span>
                      <input id="mobile" name="mobile" type="tel" inputMode="numeric"
                        maxLength={10} placeholder="05XXXXXXXX" autoComplete="tel-national"
                        value={form.mobile} onChange={handleChange} />
                    </div>
                  </Field>

                  <Field id="email" label="البريد الإلكتروني" required invalid={!!errors.email} error={errors.email}>
                    <input className="input" id="email" name="email" type="email"
                      placeholder="name@example.com" autoComplete="email"
                      value={form.email} onChange={handleChange} />
                  </Field>
                </div>

                <div className="field-row">
                  <Field id="specialty" label="التخصّص" required invalid={!!errors.specialty} error={errors.specialty}>
                    <select className="select" id="specialty" name="specialty" required
                      value={form.specialty} onChange={handleChange}>
                      <option value="" disabled>اختر تخصّصك</option>
                      <option value="photo">مصوّر فوتوغرافي</option>
                      <option value="video">مصوّر فيديو</option>
                      <option value="content">صانع محتوى</option>
                      <option value="graphic">مصمّم جرافيك</option>
                      <option value="motion">موشن ديزاينر</option>
                      <option value="ai">متخصّص AI</option>
                      <option value="editor">مونتير</option>
                      <option value="other">أخرى</option>
                    </select>
                  </Field>
                  <Field id="experience" label="سنوات الخبرة" required invalid={!!errors.experience} error={errors.experience}>
                    <select className="select" id="experience" name="experience"
                      value={form.experience} onChange={handleChange}>
                      <option value="" disabled>اختر مدّة خبرتك</option>
                      <option value="0-1">أقل من سنة</option>
                      <option value="1-3">١ – ٣ سنوات</option>
                      <option value="3-5">٣ – ٥ سنوات</option>
                      <option value="5-10">٥ – ١٠ سنوات</option>
                      <option value="10+">أكثر من ١٠ سنوات</option>
                    </select>
                  </Field>
                </div>

                <Field id="aiExperience" label="هل سبق لك استخدام أدوات الذكاء الاصطناعي في أعمالك؟" required
                  hint="مثل Midjourney، Runway، Sora، ChatGPT، Adobe Firefly، وغيرها"
                  invalid={!!errors.aiExperience} error="الرجاء اختيار إجابة">
                  <div style={{display:'flex', gap:'12px', marginTop:'4px'}}>
                    {[{v:'yes', label:'نعم، أستخدمها بانتظام'}, {v:'sometimes', label:'أحياناً / جرّبتها'}, {v:'no', label:'لا، لم أجرّبها بعد'}].map(opt => (
                      <label key={opt.v} style={{
                        flex:1, display:'flex', alignItems:'center', gap:'10px', cursor:'pointer',
                        padding:'12px 16px', borderRadius:'12px', border:'1.5px solid',
                        borderColor: form.aiExperience === opt.v ? 'var(--green-500)' : 'var(--ink-200)',
                        background: form.aiExperience === opt.v ? 'var(--green-50)' : 'var(--paper-tint)',
                        transition:'all .2s ease', fontSize:'14px', fontWeight: form.aiExperience === opt.v ? 600 : 400,
                        color: form.aiExperience === opt.v ? 'var(--green-700)' : 'var(--ink-700)',
                      }}>
                        <input type="radio" name="aiExperience" value={opt.v}
                          checked={form.aiExperience === opt.v}
                          onChange={handleChange}
                          style={{accentColor:'var(--green-500)', width:'16px', height:'16px'}} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </Field>

                <div className="field-row">
                <Field id="portfolio" label="رابط الأعمال" required
                  hint="إجباري — رابط يعرض نماذج من أعمالك مثل Behance أو Drive أو موقع شخصي"
                  invalid={!!errors.portfolio} error={errors.portfolio}>
                  <input className="input" id="portfolio" name="portfolio" type="url"
                    placeholder="https://behance.net/yourname"
                    value={form.portfolio} onChange={handleChange} />
                </Field>

                <Field id="socialAccount" label="رابط الحساب"
                  hint="اختياري — حسابك في Instagram أو X أو TikTok أو LinkedIn"
                  invalid={!!errors.socialAccount} error={errors.socialAccount}>
                  <input className="input" id="socialAccount" name="socialAccount" type="url"
                    placeholder="https://instagram.com/yourname"
                    value={form.socialAccount} onChange={handleChange} />
                </Field>
                </div>

                <Field id="notes" label="دافعك للانضمام" required invalid={!!errors.notes} error="الرجاء كتابة دافعك للانضمام">
                  <textarea id="notes" name="notes" rows={4}
                    placeholder="اكتب لنا في سطرين: لماذا تَبصَّر؟ وماذا تتوقّع أن تخرج به؟"
                    value={form.notes} onChange={handleChange} />
                </Field>

                {formError && <div className="form-error-banner">{formError}</div>}

                <div className={styles.actions}>
                  <button type="submit" className={`btn btn-primary ${loading ? styles.isLoading : ''}`}
                    disabled={loading}>
                    {loading && <span className={styles.spinner} aria-hidden="true" />}
                    <span>إرسال التسجيل</span>
                    {!loading && <span className="arrow">→</span>}
                  </button>
                  <p className={styles.tos}>
                    بإرسالك هذا النموذج، توافق على <a href="#">سياسة الخصوصية</a> ومعالجة بياناتك لأغراض الاختيار والتواصل.
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
              <h3 className={styles.successTitle}>تمّ تسجيلك بنجاح! 🎉</h3>

              {/* النص */}
              <p className={styles.successMsg}>
                وصل طلبك إلى فريق <strong>تَبصَّر</strong>، وأنت الآن خطوةً أقرب نحو تجربة لن تنساها.
                سنراجع أعمالك ونتواصل معك خلال أسبوع على البريد أو الجوال.
              </p>

              {/* كلام محفّز */}
              <div className={styles.successQuote}>
                <span className={styles.quoteIcon}>"</span>
                <p>العدسة الحقيقية ليست في يدك، بل في طريقة رؤيتك للعالم.</p>
                <span className={styles.quoteIcon}>"</span>
              </div>

              {/* رقم الطلب */}
              <div className={styles.receipt}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
                رقم الطلب: <strong>{receiptId}</strong>
              </div>

              {/* الأزرار */}
              <div className={styles.successActions}>
                <Link className="btn btn-primary" to="/">
                  <span>العودة للرئيسية</span>
                  <span className="arrow">→</span>
                </Link>
                <button className="btn btn-ghost" onClick={resetForm} type="button">
                  تسجيل شخص آخر
                </button>
              </div>

            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        © ٢٠٢٦ تَبصَّر · حيث تلتقي العدسة بالتاريخ · بشراكة أمانة المدينة المنوّرة × مُكعّب
      </footer>
    </div>
  )
}
