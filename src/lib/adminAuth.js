/* ─── جلسة الأدمن المشتركة (Supabase Auth بإيميل وكلمة مرور) ───
 * تُستخدم في لوحة أدمن تَبصَّر (/admin) ولوحة أدمن التحكيم (/judge/admin)
 * حتى لا يكون هناك نظامان للدخول. الجلسة محفوظة في sessionStorage فقط
 * (انظر src/lib/supabase.js) وتنتهي بإغلاق النافذة أو بعد 30 دقيقة بلا نشاط. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseActive } from './supabase'

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').trim()
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000

// يمسح جلسة Supabase المحفوظة في هذا التبويب حتى لو تعذّر الاتصال بالسيرفر.
export function clearStoredAdminSession() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('sb-') || key === 'tabasur_admin_auth') sessionStorage.removeItem(key)
    }
  } catch { /* التخزين غير متاح */ }
}

// رابط "إعادة تعيين كلمة المرور" يرجع من Supabase بصيغة
//   /admin#access_token=...&refresh_token=...&type=recovery
// والعميل مضبوط على detectSessionInUrl:false، فنقرأ الرابط يدويًا هنا.
export function readRecoveryHash() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash || ''
  if (!hash.includes('access_token=')) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('type') !== 'recovery') return null
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

export function isRecoveryHash(hash = '') {
  return hash.includes('access_token=') && hash.includes('type=recovery')
}

// رسائل عربية واضحة لأخطاء Supabase Auth الشائعة.
export function translateAuthError(err) {
  const code = err?.code || ''
  const msg = err?.message || ''
  if (err?.status === 429 || /rate_limit/.test(code)) return 'محاولات كثيرة — انتظر دقيقة ثم حاول مرة أخرى.'
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return 'البريد أو كلمة المرور غير صحيحة. تأكد أن هذا البريد مضاف كمستخدم في Supabase (Authentication → Users)، أو استخدم «نسيت كلمة المرور».'
  if (code === 'email_not_confirmed') return 'البريد غير مؤكَّد بعد — أكّده من Supabase (Authentication → Users) ثم حاول مجددًا.'
  if (code === 'email_provider_disabled') return 'الدخول بالبريد وكلمة المرور معطّل في إعدادات Supabase Auth.'
  if (code === 'validation_failed') return 'صيغة البريد الإلكتروني غير صحيحة.'
  if (code === 'same_password') return 'كلمة المرور الجديدة مطابقة للقديمة.'
  if (code === 'weak_password') return 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل.'
  if (code === 'otp_expired' || /expired/i.test(msg)) return 'انتهت صلاحية الرابط — اطلب رابطًا جديدًا.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'تعذّر الاتصال بـ Supabase — تحقق من الشبكة ومن متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.'
  return msg || 'حدث خطأ غير متوقع.'
}

/**
 * status:
 *   'unavailable' → متغيرات Supabase غير موجودة
 *   'loading'     → نقرأ الجلسة
 *   'signed_out'  → اعرض نموذج الدخول
 *   'recovery'    → وصل من رابط إعادة التعيين: اعرض نموذج كلمة مرور جديدة
 *   'signed_in'   → اعرض اللوحة
 */
export function useAdminSession({ idleTimeoutMs = ADMIN_IDLE_TIMEOUT_MS, recoveryPath = '/admin' } = {}) {
  const [status, setStatus] = useState(isSupabaseActive ? 'loading' : 'unavailable')
  const [session, setSession] = useState(null)
  const recovering = useRef(false)

  useEffect(() => {
    // مسح علامة الدخول القديمة اللي كانت تسمح بتجاوز كلمة المرور
    try { sessionStorage.removeItem('tabasur_admin_auth') } catch { /* التخزين غير متاح */ }
    if (!isSupabaseActive) return
    let active = true

    const recovery = readRecoveryHash()
    if (recovery) {
      recovering.current = true
      // نشيل التوكن من شريط العنوان فورًا حتى لا يبقى في السجل
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* ignore */ }
      supabase.auth.setSession(recovery)
        .then(({ data, error }) => {
          if (!active) return
          if (error || !data?.session) { recovering.current = false; setSession(null); setStatus('signed_out'); return }
          setSession(data.session)
          setStatus('recovery')
        })
        .catch(() => { if (active) { recovering.current = false; setStatus('signed_out') } })
    } else {
      supabase.auth.getSession()
        .then(({ data }) => { if (active) { setSession(data?.session ?? null); setStatus(data?.session ? 'signed_in' : 'signed_out') } })
        .catch(() => { if (active) setStatus('signed_out') })
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active || event === 'INITIAL_SESSION') return
      setSession(s ?? null)
      if (event === 'PASSWORD_RECOVERY') { recovering.current = true; setStatus('recovery'); return }
      if (!s) { recovering.current = false; setStatus('signed_out'); return }
      setStatus(recovering.current ? 'recovery' : 'signed_in')
    })
    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseActive) throw new Error('unavailable')
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(email || '').trim(), password })
    if (error) throw error
    if (!data?.session) throw new Error('no_session')
    recovering.current = false
    setSession(data.session)
    setStatus('signed_in')
    return data.session
  }, [])

  const signOut = useCallback(async () => {
    recovering.current = false
    setSession(null)
    setStatus('signed_out')
    try { if (supabase) await supabase.auth.signOut() } catch { /* نكمل المسح المحلي */ }
    clearStoredAdminSession()
  }, [])

  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseActive) throw new Error('unavailable')
    const redirectTo = `${window.location.origin}${recoveryPath}`
    const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo })
    if (error) throw error
  }, [recoveryPath])

  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseActive) throw new Error('unavailable')
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    recovering.current = false
    setStatus('signed_in')
    return data?.user
  }, [])

  /* ─── خروج تلقائي عند عدم النشاط ─── */
  useEffect(() => {
    if (status !== 'signed_in' || !idleTimeoutMs) return
    let lastActivity = Date.now()
    const markActive = () => { lastActivity = Date.now() }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    events.forEach(ev => window.addEventListener(ev, markActive, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > idleTimeoutMs) signOut()
    }, 60 * 1000)
    return () => {
      clearInterval(timer)
      events.forEach(ev => window.removeEventListener(ev, markActive))
    }
  }, [status, idleTimeoutMs, signOut])

  return {
    status,
    session,
    user: session?.user ?? null,
    isActive: isSupabaseActive,
    adminEmail: ADMIN_EMAIL,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }
}
