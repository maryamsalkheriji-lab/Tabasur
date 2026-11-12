// طبقة البيانات: تنفيذان بالواجهة نفسها.
//   supabaseRepo(sb)  → الإنتاج عبر PostgREST بمفتاح service_role.
//   pgliteRepo(db)    → الاختبارات المحلية على Postgres حقيقي داخل العملية (نفس ملف SQL).
import { DbError, readKV, writeKV, deleteKV } from './db.js'

export class RegisterTeamError extends Error {
  constructor(code, mobileKey = '') { super(code); this.code = code; this.mobileKey = mobileKey }
}

// كل أعمدة الفريق: لو أُضيف عمود في الكود قبل تشغيل ملف SQL على القاعدة لا يتعطل التسليم العام، والواجهة العامة (teamCard) تختار حقولها صراحةً.
const TEAM_COLUMNS = '*'
const MEMBER_COLUMNS = 'id,team_id,mobile,mobile_key,name_key,full_name,registration_id,is_leader,position,created_at'

function translateRegisterError(message, detail) {
  const code = String(message || '').trim()
  const text = `${code} ${detail || ''}`
  if (['TEAM_NAME_TAKEN', 'MOBILE_TAKEN', 'NAME_TAKEN', 'INVALID_MEMBERS'].includes(code)) return new RegisterTeamError(code, String(detail || ''))
  if (/tb_teams_name_key_key/.test(text)) return new RegisterTeamError('TEAM_NAME_TAKEN')
  if (/tb_team_members_mobile_key_key/.test(text)) return new RegisterTeamError('MOBILE_TAKEN')
  if (/tb_team_members_name_key_key/.test(text)) return new RegisterTeamError('NAME_TAKEN')
  return null
}

export function supabaseRepo(sb) {
  const unwrap = ({ data, error }) => { if (error) throw new DbError(error); return data }
  const repo = {
    readSetting: key => readKV(sb, 'tb_settings', key),
    writeSetting: (key, value) => writeKV(sb, 'tb_settings', key, value),
    readSecret: key => readKV(sb, 'tb_secrets', key),
    writeSecret: (key, value) => writeKV(sb, 'tb_secrets', key, value),
    deleteSecret: key => deleteKV(sb, 'tb_secrets', key),

    async findRegistrationsByMobileKeys(keys) {
      if (!keys.length) return []
      return unwrap(await sb.from('registrations').select('id,full_name,email,mobile,mobile_key,created_at').in('mobile_key', keys).order('created_at', { ascending: false }))
    },
    async findMembersByKeys(mobileKeys, nameKeys) {
      const rows = []
      if (mobileKeys.length) rows.push(...unwrap(await sb.from('tb_team_members').select('mobile_key,name_key,team_id,tb_teams(code)').in('mobile_key', mobileKeys)))
      if (nameKeys.length) rows.push(...unwrap(await sb.from('tb_team_members').select('mobile_key,name_key,team_id,tb_teams(code)').in('name_key', nameKeys)))
      return rows.map(row => ({ mobile_key: row.mobile_key, name_key: row.name_key, team_id: row.team_id, team_code: row.tb_teams?.code || '' }))
    },
    async registerTeam({ name, nameKey, track, members }) {
      const { data, error } = await sb.rpc('tb_register_team', { p_name: name, p_name_key: nameKey, p_track: track, p_members: members })
      if (error) {
        const known = translateRegisterError(error.message, error.details)
        if (known) throw known
        throw new DbError(error)
      }
      return Array.isArray(data) ? data[0] : data
    },
    async getTeamByCode(code) {
      return unwrap(await sb.from('tb_teams').select(TEAM_COLUMNS).eq('code', code).maybeSingle())
    },
    async getTeamById(id) {
      return unwrap(await sb.from('tb_teams').select(TEAM_COLUMNS).eq('id', id).maybeSingle())
    },
    async getTeamByMobileKey(mobileKey) {
      const member = unwrap(await sb.from('tb_team_members').select('team_id').eq('mobile_key', mobileKey).maybeSingle())
      return member ? repo.getTeamById(member.team_id) : null
    },
    async listMembers(teamId) {
      return unwrap(await sb.from('tb_team_members').select(MEMBER_COLUMNS).eq('team_id', teamId).order('position'))
    },
    async updateTeam(id, patch) {
      return unwrap(await sb.from('tb_teams').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(TEAM_COLUMNS).single())
    },
    async logUpload(entry) {
      unwrap(await sb.from('tb_upload_log').insert(entry))
    },
    async listTeamsWithMembers() {
      const teams = unwrap(await sb.from('tb_teams').select(`${TEAM_COLUMNS},tb_team_members(${MEMBER_COLUMNS})`).order('created_at', { ascending: false }))
      const flags = unwrap(await sb.from('tb_admin_members').select('id,in_person'))
      const inPerson = new Map(flags.map(row => [row.id, row.in_person]))
      return teams.map(team => {
        const members = [...(team.tb_team_members || [])].sort((a, b) => a.position - b.position).map(member => ({ ...member, in_person: Boolean(inPerson.get(member.id)) }))
        const { tb_team_members: _ignored, ...rest } = team
        return { ...rest, members }
      })
    },
    async deleteTeam(id) { unwrap(await sb.from('tb_teams').delete().eq('id', id)) },
    async removeMember(memberId) { unwrap(await sb.from('tb_team_members').delete().eq('id', memberId)) },
    // هل شُغّل ملف review-2026-11-12.sql؟ (أعمدة القرار موجودة)
    async hasReviewColumns() {
      const { error } = await sb.from('tb_teams').select('review_status').limit(1)
      return !error
    },
    async getMember(memberId) { return unwrap(await sb.from('tb_team_members').select(MEMBER_COLUMNS).eq('id', memberId).maybeSingle()) },
    async countInperson() {
      const { count, error } = await sb.from('tb_inperson').select('email', { count: 'exact', head: true })
      if (error) throw new DbError(error)
      return count || 0
    },
    async countRegistrations() {
      const { count, error } = await sb.from('registrations').select('id', { count: 'exact', head: true })
      if (error) throw new DbError(error)
      return count || 0
    },
  }
  return repo
}

// نفس الواجهة فوق PGlite (للاختبارات): استعلامات SQL مباشرة.
export function pgliteRepo(db) {
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows
  const one = async (sql, params = []) => (await rows(sql, params))[0] || null
  const kv = table => ({
    async read(key) { const row = await one(`select value from public.${table} where key = $1`, [key]); return row ? row.value : null },
    async write(key, value) {
      await db.query(`insert into public.${table} (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(value)])
    },
    async remove(key) { await db.query(`delete from public.${table} where key = $1`, [key]) },
  })
  const settings = kv('tb_settings'), secrets = kv('tb_secrets')
  const parseJson = value => (typeof value === 'string' ? JSON.parse(value) : value)
  const fixTeam = team => team && { ...team, pending_upload: parseJson(team.pending_upload), video_size: team.video_size === null || team.video_size === undefined ? null : Number(team.video_size) }
  return {
    readSetting: settings.read, writeSetting: settings.write,
    readSecret: secrets.read, writeSecret: secrets.write, deleteSecret: secrets.remove,
    async findRegistrationsByMobileKeys(keys) {
      if (!keys.length) return []
      return rows('select id, full_name, email, mobile, mobile_key, created_at from public.registrations where mobile_key = any($1) order by created_at desc', [keys])
    },
    async findMembersByKeys(mobileKeys, nameKeys) {
      return rows('select tm.mobile_key, tm.name_key, tm.team_id, t.code as team_code from public.tb_team_members tm join public.tb_teams t on t.id = tm.team_id where tm.mobile_key = any($1) or tm.name_key = any($2)', [mobileKeys, nameKeys])
    },
    async registerTeam({ name, nameKey, track, members }) {
      try {
        return fixTeam(await one('select * from public.tb_register_team($1, $2, $3, $4::jsonb)', [name, nameKey, track, JSON.stringify(members)]))
      } catch (error) {
        const known = translateRegisterError(error.message, error.detail || error.constraint || '')
        if (known) throw known
        throw error
      }
    },
    async getTeamByCode(code) { return fixTeam(await one('select * from public.tb_teams where code = $1', [code])) },
    async getTeamById(id) { return fixTeam(await one('select * from public.tb_teams where id = $1', [id])) },
    async getTeamByMobileKey(mobileKey) {
      return fixTeam(await one('select t.* from public.tb_teams t join public.tb_team_members tm on tm.team_id = t.id where tm.mobile_key = $1', [mobileKey]))
    },
    async listMembers(teamId) { return rows('select * from public.tb_team_members where team_id = $1 order by position', [teamId]) },
    async updateTeam(id, patch) {
      const keys = Object.keys(patch)
      const sets = keys.map((key, index) => `${key} = $${index + 2}${key === 'pending_upload' ? '::jsonb' : ''}`)
      const values = keys.map(key => (key === 'pending_upload' && patch[key] !== null ? JSON.stringify(patch[key]) : patch[key]))
      return fixTeam(await one(`update public.tb_teams set ${[...sets, 'updated_at = now()'].join(', ')} where id = $1 returning *`, [id, ...values]))
    },
    async logUpload(entry) {
      await db.query('insert into public.tb_upload_log (team_id, team_code, action, file_id, file_name, file_size, detail) values ($1, $2, $3, $4, $5, $6, $7::jsonb)',
        [entry.team_id || null, entry.team_code || null, entry.action, entry.file_id || null, entry.file_name || null, entry.file_size ?? null, JSON.stringify(entry.detail ?? null)])
    },
    async listTeamsWithMembers() {
      const teams = (await rows('select * from public.tb_teams order by created_at desc')).map(fixTeam)
      const members = await rows('select * from public.tb_admin_members order by position')
      return teams.map(team => ({ ...team, members: members.filter(member => member.team_id === team.id) }))
    },
    async deleteTeam(id) { await db.query('delete from public.tb_teams where id = $1', [id]) },
    async hasReviewColumns() {
      try { await db.query('select review_status from public.tb_teams limit 1'); return true } catch { return false }
    },
    async removeMember(memberId) { await db.query('delete from public.tb_team_members where id = $1', [memberId]) },
    async getMember(memberId) { return one('select * from public.tb_team_members where id = $1', [memberId]) },
    async countInperson() { return Number((await one('select count(*)::int as n from public.tb_inperson')).n) },
    async countRegistrations() { return Number((await one('select count(*)::int as n from public.registrations')).n) },
  }
}
