export async function sendRegistrationEmail(payload) {
  try {
    const response = await fetch('/api/send-registration-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    })
    const data = await response.json().catch(() => null)
    if (!data && response.ok) return { ok: false, code: 'EMAIL_ROUTE_MISSING' }
    if (!response.ok || data?.ok !== true) {
      return { ok: false, code: response.status === 404 ? 'EMAIL_ROUTE_MISSING' : data?.code || 'EMAIL_SEND_FAILED' }
    }
    return { ok: true }
  } catch {
    return { ok: false, code: 'EMAIL_CONNECTION_FAILED' }
  }
}
