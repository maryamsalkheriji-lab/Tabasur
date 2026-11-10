// وصول السيرفر إلى Supabase بمفتاح service_role (الجداول tb_* مقفولة أمام الزوار بالكامل).
import { createClient } from '@supabase/supabase-js'

export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return url && key ? { url, key } : null
}

export function serviceClient() {
  const config = supabaseConfig()
  if (!config) return null
  return createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export class DbError extends Error {
  constructor(error) { super(error?.message || 'DB_ERROR'); this.code = error?.code || ''; this.details = error?.details || ''; this.hint = error?.hint || '' }
}

export async function readKV(sb, table, key) {
  const { data, error } = await sb.from(table).select('value').eq('key', key).maybeSingle()
  if (error) throw new DbError(error)
  return data?.value ?? null
}

export async function writeKV(sb, table, key, value) {
  const { error } = await sb.from(table).upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new DbError(error)
}

export async function deleteKV(sb, table, key) {
  const { error } = await sb.from(table).delete().eq('key', key)
  if (error) throw new DbError(error)
}
