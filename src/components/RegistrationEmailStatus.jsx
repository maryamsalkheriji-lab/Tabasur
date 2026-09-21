import { useEffect, useRef, useState } from 'react'
import { sendRegistrationEmail } from '../lib/registration-email'

const failureMessages = {
  EMAIL_NOT_CONFIGURED: 'خدمة البريد غير مفعّلة حاليًا. يرجى التواصل معنا.',
  EMAIL_ROUTE_MISSING: 'خدمة البريد غير متاحة في هذه النسخة من الموقع. يرجى التواصل معنا.',
  EMAIL_AUTH_FAILED: 'تعذّر اتصال الموقع بخدمة البريد بسبب إعدادات الخدمة. يرجى التواصل معنا.',
  EMAIL_SENDER_UNVERIFIED: 'عنوان الإرسال لم يُعتمد بعد لدى خدمة البريد. يرجى التواصل معنا.',
  EMAIL_ACCOUNT_PENDING: 'خدمة البريد بانتظار التفعيل من المزوّد.',
  EMAIL_ACCOUNT_BLOCKED: 'خدمة البريد متوقفة مؤقتًا. يرجى التواصل معنا.',
  EMAIL_CREDITS_EXPIRED: 'خدمة البريد تحتاج إلى تجديد الرصيد. يرجى التواصل معنا.',
  EMAIL_CREDITS_EXHAUSTED: 'نفد رصيد خدمة البريد. يرجى التواصل معنا.',
  EMAIL_LIMIT_REACHED: 'وصلت خدمة البريد إلى حد الإرسال المتاح. حاول لاحقًا.',
  EMAIL_IP_RESTRICTED: 'خدمة البريد لا تسمح بالاتصال من الموقع حاليًا. يرجى التواصل معنا.',
  EMAIL_CONNECTION_FAILED: 'تعذّر الاتصال بخدمة البريد. تحقّق من اتصالك وحاول مرة أخرى.',
}

export default function RegistrationEmailStatus({ email, fullName, receiptId, kind, simulated }) {
  const [status, setStatus] = useState('sending')
  const [failureCode, setFailureCode] = useState(null)
  const initialRequest = useRef(null)
  const busy = useRef(false)

  useEffect(() => {
    if (simulated) return
    let active = true
    // Reuse the request when React StrictMode replays effects.
    initialRequest.current ??= sendRegistrationEmail({ email, fullName, receiptId, kind })
    initialRequest.current.then(result => {
      if (active) {
        setStatus(result.ok ? 'accepted' : 'failed')
        setFailureCode(result.code || null)
      }
    })
    return () => { active = false }
  }, [email, fullName, receiptId, kind, simulated])

  async function retry() {
    if (busy.current) return
    busy.current = true
    setStatus('sending')
    const result = await sendRegistrationEmail({ email, fullName, receiptId, kind })
    setStatus(result.ok ? 'accepted' : 'failed')
    setFailureCode(result.code || null)
    busy.current = false
  }

  return (
    <div role="status" aria-live="polite" style={{ margin: '20px 0', padding: '16px 20px', borderRadius: 14, background: 'var(--paper-tint)', color: 'var(--ink-700)', fontSize: 14 }}>
      {simulated ? 'هذا تسجيل تجريبي، ولم يُحفظ الطلب أو يُرسل بريد تأكيد.' : status === 'sending' ? 'جارٍ إرسال رسالة التأكيد إلى بريدك…' : status === 'accepted' ? 'تم إرسال رسالة التأكيد. إذا لم تظهر في الوارد، تفقّد البريد غير المرغوب فيه.' : <>
        <p>طلبك محفوظ، لكن تعذّر تأكيد إرسال الإيميل. لا تحتاج إلى التسجيل مرة أخرى.</p>
        {failureMessages[failureCode] && <p style={{ marginTop: 8 }}>{failureMessages[failureCode]}</p>}
        <button type="button" onClick={retry} style={{ marginTop: 10, textDecoration: 'underline', fontWeight: 700, color: 'var(--teal-600)' }}>إعادة محاولة إرسال الإيميل</button>
      </>}
    </div>
  )
}
