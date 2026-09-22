import { loadEnv } from 'vite'

/* ─── حارس المفاتيح السرية ───
 * أي متغير يبدأ بـ VITE_ ينكتب داخل كود الموقع ويقدر أي زائر يشوفه.
 * لو انحط فيه مفتاح سري بالغلط، البناء يوقف بدل ما يتسرب المفتاح. */

function decodeJwtRole(value) {
  const payload = String(value).split('.')[1]
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role || null
  } catch {
    return null
  }
}

export function findPublicEnvSecrets(env) {
  const problems = []
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_') || !value) continue
    if (/SERVICE_ROLE|SECRET|TOKEN|PASSWORD|PRIVATE/i.test(name)) {
      problems.push(`${name}: اسمه يدل إنه سري — احذفيه أو شيلي VITE_ من اسمه`)
    } else if (/^sb_secret_/.test(value) || decodeJwtRole(value) === 'service_role') {
      problems.push(`${name}: قيمته مفتاح Supabase سري (service_role) — استخدمي المفتاح العام anon`)
    }
  }
  return problems
}

export function assertNoSecretsInPublicEnv(mode, cwd = process.cwd()) {
  const publicEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('VITE_'))),
    ...loadEnv(mode, cwd, 'VITE_'),
  }
  const problems = findPublicEnvSecrets(publicEnv)
  if (problems.length) {
    throw new Error(`تم إيقاف البناء لحماية المفاتيح السرية:\n- ${problems.join('\n- ')}`)
  }
}
