import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const KEY = "jd_judge_session";

// في التطوير المحلي تمرّ الدالة عبر بروكسي Vite (انظر vite.config.js) بسبب CORS،
// وفي النسخة المنشورة تُستدعى من رابط Supabase مباشرة.
const FUNCTIONS_BASE = import.meta.env.DEV ? "/__supabase/functions/v1" : `${URL}/functions/v1`;

export async function judgeLogin(slug, code) {
  const res = await fetch(`${FUNCTIONS_BASE}/judge-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ slug, code }),
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || "login_failed");
  sessionStorage.setItem(KEY, JSON.stringify({ ...data, slug }));
  return data;
}
export function getJudgeSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}
export function judgeLogout() { sessionStorage.removeItem(KEY); }
export function judgeSupabase() {
  const s = getJudgeSession();
  if (!s?.token) return null;
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${s.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// هل التوكن ما زال صالحًا؟ (صلاحيته 12 ساعة من الدخول)
export function judgeSessionExpired() {
  const s = getJudgeSession();
  if (!s?.token) return true;
  try {
    const payload = JSON.parse(atob(s.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch { return true; }
}
