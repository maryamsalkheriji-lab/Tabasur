import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// جلسة الأدمن تنحفظ في sessionStorage فقط، فتنمسح أول ما تنقفل نافذة المتصفح.
function browserSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined
  } catch {
    return undefined
  }
}

export const isSupabaseActive = Boolean(supabaseUrl && supabaseKey)
export const supabase = isSupabaseActive
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: browserSessionStorage(),
        persistSession: true,
        autoRefreshToken: true,
        // ما نستخدم روابط دخول من الإيميل، فنقفل قراءة الجلسة من الرابط.
        detectSessionInUrl: false,
      },
    })
  : null

export function formatSupabaseError(error) {
  const message = error?.message || String(error || '')

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'تعذر الاتصال بـ Supabase. تأكدي من متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel ثم اعملي Redeploy.'
  }

  return message || 'حدث خطأ غير معروف في الاتصال بقاعدة البيانات.'
}
