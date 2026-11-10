// قاعدة Postgres محلية داخل العملية (PGlite) للاختبارات وسيرفر التطوير فقط.
// تُنشئ جدول التسجيلات بالحد الأدنى ثم تشغّل ملف SQL الحقيقي للتسليمات.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pgliteRepo } from './repo.js'

export const SQL_FILE = fileURLToPath(new URL('../../supabase/submissions-2026-11-10.sql', import.meta.url))

export const SAMPLE_REGISTRATIONS = Object.freeze([
  { full_name: 'سارة محمد الحربي', email: 'sara@example.com', mobile: '0501111111' },
  { full_name: 'عبدالله خالد العمري', email: 'abdullah@example.com', mobile: '0502222222' },
  { full_name: 'نورة سعد الجهني', email: 'noura@example.com', mobile: '0503333333' },
  { full_name: 'محمد عبدالله الخيبري', email: 'mohammed.a@example.com', mobile: '0504444444' },
  { full_name: 'محمد عبدالله الخيبري', email: 'mohammed.b@example.com', mobile: '0504444444' }, // تسجيل مكرر لنفس الشخص
  { full_name: 'Hadeel Mohammed', email: 'hadeel@example.com', mobile: '+201001234567' },
  { full_name: 'ريم فهد القحطاني', email: 'reem@example.com', mobile: '0505555555' },
  { full_name: 'ريم فهد القحطاني', email: 'reem2@example.com', mobile: '0506666666' }, // اسم مطابق لشخص آخر برقم مختلف
])

export async function createDevDatabase({ registrations = SAMPLE_REGISTRATIONS, inperson = ['sara@example.com', 'noura@example.com'] } = {}) {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create table public.registrations (
      id bigserial primary key, full_name text not null, email text not null unique, mobile text not null,
      city text, specialty text, created_at timestamptz not null default now()
    );
  `)
  await db.exec(await readFile(SQL_FILE, 'utf8'))
  for (const row of registrations) {
    await db.query('insert into public.registrations (full_name, email, mobile) values ($1, $2, $3)', [row.full_name, row.email, row.mobile])
  }
  for (const email of inperson) await db.query('insert into public.tb_inperson (email, batch) values ($1, $2)', [email, 'dev'])
  const repo = pgliteRepo(db)
  // SUBMISSIONS_DEV_DRIVE=connected يربط المحاكي (tests/helpers/fake-drive.mjs) حتى تعمل صفحة الرفع كاملة محليًا.
  if (process.env.SUBMISSIONS_DEV_DRIVE === 'connected') {
    await repo.writeSecret('drive_oauth', { client_id: 'dev.apps.googleusercontent.com', client_secret: 'dev-secret-value', refresh_token: 'fake-refresh-token', email: 'organizer@example.com', connected_at: new Date().toISOString() })
  }
  repo.db = db
  return repo
}
