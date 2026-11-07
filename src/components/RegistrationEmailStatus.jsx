import { useEffect, useRef, useState } from 'react'
import { sendRegistrationEmail } from '../lib/registration-email'
import { useLanguage } from '../lib/language'

export default function RegistrationEmailStatus({ email, fullName, receiptId, kind, simulated }) {
  const { t } = useLanguage()
  const copy = t.emailStatus
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
      {simulated ? copy.simulated : status === 'sending' ? copy.sending : status === 'accepted' ? copy.accepted : <>
        <p>{copy.failed}</p>
        {copy.failures[failureCode] && <p style={{ marginTop: 8 }}>{copy.failures[failureCode]}</p>}
        <button type="button" onClick={retry} style={{ marginTop: 10, textDecoration: 'underline', fontWeight: 700, color: 'var(--teal-600)' }}>{copy.retry}</button>
      </>}
    </div>
  )
}
