// supabase/functions/judge-login/index.ts
// POST { slug, code }  →  { token, judge: { id, name }, event_id }
// نشر:  supabase functions deploy judge-login
// سرّ:  supabase secrets set JWT_SECRET=<JWT Secret من Settings → API>

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { SignJWT } from "npm:jose@5.9.6";

const cors = {
  "Access-Control-Allow-Origin": "https://cubex.com.sa",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// حد بسيط ضد التخمين: 10 محاولات لكل IP كل 10 دقائق (في ذاكرة الـ instance)
const attempts = new Map<string, { n: number; at: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.at > 10 * 60_000) { attempts.set(ip, { n: 1, at: now }); return false; }
  a.n++;
  return a.n > 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (rateLimited(ip)) return json({ error: "too_many_attempts" }, 429);

  let body: { slug?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const slug = (body.slug ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || code.length < 6 || code.length > 20)
    return json({ error: "invalid_input" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.rpc("jd_verify_code", { p_slug: slug, p_code: code });
  if (error) return json({ error: "server" }, 500);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return json({ error: "invalid_code" }, 401);

  const secret = new TextEncoder().encode(Deno.env.get("JWT_SECRET")!);
  const token = await new SignJWT({
    role: "authenticated",          // مطلوب حتى تقبل PostgREST الطلب
    judge_id: row.judge_id,
    event_id: row.event_id,
    judge_name: row.judge_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")       // جلسة يوم التحكيم فقط
    .sign(secret);

  return json({ token, judge: { id: row.judge_id, name: row.judge_name }, event_id: row.event_id });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
