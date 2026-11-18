// /api/submissions: تسجيل الفرق ورفع فيديو واحد لكل فريق إلى حاوية Supabase Storage الخاصة بالمنظّمة.
// المتصفح لا يرى الحاوية ولا ملفات غيره: السيرفر يصدر توكن رفع مؤقتًا لمسار واحد، ثم يتحقق من الملف بعد الاكتمال.
import { randomBytes } from 'node:crypto'
import { serviceClient, DbError } from './db.js'
import { supabaseRepo, RegisterTeamError } from './repo.js'
import { createStorage, storageConfig, StorageError, TUS_CHUNK_SIZE, SIGNED_UPLOAD_TTL_MS } from './storage.js'
import {
  TRACKS, TRACK_LABELS, MAX_MEMBERS, TEAM_CODE_PATTERN, REVIEW_STATUSES, CONSENT_FORM_VERSION, CONSENT_MAX_BYTES,
  parseMobile, nameKey, teamNameKey, cleanText, videoExtension, isVideoFile, driveFileName, consentExtension, consentMime, normalizeNationalId, consentFileName,
} from './keys.js'

export const CHUNK_SIZE = TUS_CHUNK_SIZE
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const INCLUDED_STORAGE_BYTES = 100 * 1024 * 1024 * 1024 // المضمّن في خطة Pro قبل الرسوم الإضافية
const SESSION_REUSE_MS = SIGNED_UPLOAD_TTL_MS - 15 * 60 * 1000 // نعيد استخدام التوكن ما دام صالحًا بهامش
const MAX_BODY_BYTES = 16384
const RATE_LIMIT_PER_MINUTE = 90
const VIEW_URL_SECONDS = 60 * 60
const CONSENT_URL_BATCH = 200

export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra }
}

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(payload))
}

// في النسخة المنشورة نقبل الطلبات من موقعنا فقط.
function originAllowed(req) {
  if (process.env.VERCEL_ENV !== 'production') return true
  const origin = req.headers?.origin
  if (!origin) return true
  const allowed = new Set()
  for (const value of [process.env.PUBLIC_SITE_URL || 'https://cubex.com.sa', ...(process.env.ALLOWED_ORIGINS || '').split(',')]) {
    try {
      const url = new URL(value.trim())
      allowed.add(url.origin)
      if (!url.hostname.startsWith('www.')) allowed.add(`${url.protocol}//www.${url.host}`)
    } catch { /* قيمة غير صالحة نتجاهلها */ }
  }
  return allowed.has(origin)
}

function parseBody(req) {
  if (req.body === undefined || req.body === null || req.body === '') return {}
  if (typeof req.body === 'string') {
    if (req.body.length > MAX_BODY_BYTES) throw new HttpError(413, 'BODY_TOO_LARGE')
    return JSON.parse(req.body)
  }
  if (typeof req.body === 'object') return req.body
  throw new HttpError(400, 'INVALID_REQUEST')
}

function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || 'unknown'
}

const buckets = new Map()
function withinRateLimit(ip, now) {
  const minute = Math.floor(now / 60000)
  const bucket = buckets.get(ip)
  if (!bucket || bucket.minute !== minute) { buckets.set(ip, { minute, count: 1 }); if (buckets.size > 5000) buckets.clear(); return true }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT_PER_MINUTE
}

const iso = ms => new Date(ms).toISOString()

/* ─── الإعدادات ─── */
async function loadSettings(repo) {
  const stored = (await repo.readSetting('submissions')) || {}
  return { open: stored.open !== false, deadline: stored.deadline || null, maxBytes: Number(stored.max_bytes) > 0 ? Number(stored.max_bytes) : DEFAULT_MAX_BYTES }
}

function assertOpen(settings, nowMs) {
  if (!settings.open) throw new HttpError(423, 'SUBMISSIONS_CLOSED')
  if (settings.deadline && Date.parse(settings.deadline) < nowMs) throw new HttpError(423, 'DEADLINE_PASSED', { deadline: settings.deadline })
}

/* ─── الأعضاء ─── */
function parseMemberEntry(entry) {
  const value = typeof entry === 'string' ? entry : entry?.number ?? entry?.mobile
  const country = typeof entry === 'object' && entry?.country ? String(entry.country).slice(0, 2).toUpperCase() : 'SA'
  const input = cleanText(value, 24)
  return { input, country, ...parseMobile(input, country) }
}

async function resolveMembers(repo, rawMobiles) {
  if (!Array.isArray(rawMobiles) || rawMobiles.length < 1 || rawMobiles.length > MAX_MEMBERS) throw new HttpError(400, 'INVALID_MEMBERS')
  const members = rawMobiles.map(parseMemberEntry)
  const seen = new Set()
  for (const member of members) {
    if (!member.ok) continue
    if (seen.has(member.key)) throw new HttpError(400, 'DUPLICATE_MEMBER', { mobile: member.input })
    seen.add(member.key)
  }
  const registrations = await repo.findRegistrationsByMobileKeys(members.filter(m => m.ok).map(m => m.key))
  const byKey = new Map()
  for (const row of registrations) if (!byKey.has(row.mobile_key)) byKey.set(row.mobile_key, row) // الأحدث أولًا
  for (const member of members) {
    if (!member.ok) { member.status = 'invalid'; continue }
    const row = byKey.get(member.key)
    if (!row) { member.status = 'not_registered'; continue }
    member.status = 'ok'
    member.registration = row
    member.full_name = cleanText(row.full_name, 120)
    member.name_key = nameKey(row.full_name)
  }
  const ready = members.filter(m => m.status === 'ok')
  const taken = await repo.findMembersByKeys(ready.map(m => m.key), ready.map(m => m.name_key))
  for (const member of ready) {
    const hit = taken.find(t => t.mobile_key === member.key || t.name_key === member.name_key)
    if (hit) { member.status = 'in_team'; member.team_code = hit.team_code }
  }
  return members
}

function maskMobile(stored) {
  const value = String(stored || '')
  if (value.length < 6) return value
  const head = value.startsWith('+') ? value.slice(0, 4) : value.slice(0, 2)
  return `${head}•••••${value.slice(-3)}`
}

// الإقرارات: الجدول قد لا يكون موجودًا بعد إن لم يُشغَّل consents-2026-11-15.sql؛ عندها يعمل التسليم كالسابق ويظهر تنبيه في لوحة الإدارة.
function isMissingConsentsTable(error) {
  const code = String(error?.code || '')
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  return code === 'PGRST205' || code === '42P01' || (/tb_consents/.test(text) && /not find|does not exist|schema cache/i.test(text))
}

async function loadConsents(repo, teamId) {
  try { return { ready: true, rows: await repo.listConsents(teamId) } } catch (error) {
    if (isMissingConsentsTable(error)) return { ready: false, rows: [] }
    throw error
  }
}

function consentSummary(members, consents) {
  const done = members.filter(member => consents.rows.some(row => row.member_id === member.id)).length
  return { ready: consents.ready, required: members.length, done, complete: !consents.ready || done === members.length }
}

async function teamCard(repo, team) {
  const members = await repo.listMembers(team.id)
  const consents = await loadConsents(repo, team.id)
  return {
    code: team.code, name: team.name, track: team.track, trackLabel: TRACK_LABELS[team.track], createdAt: team.created_at,
    members: members.map(member => {
      const consent = consents.rows.find(row => row.member_id === member.id)
      return {
        id: member.id, name: member.full_name, mobile: maskMobile(member.mobile), leader: Boolean(member.is_leader),
        consent: consent ? { fileName: consent.file_name, size: Number(consent.file_size) || 0, uploadedAt: consent.uploaded_at } : null,
      }
    }),
    consents: consentSummary(members, consents),
    video: team.video_file_id
      ? { title: team.video_title, fileName: team.video_name, size: Number(team.video_size), uploadedAt: team.video_uploaded_at }
      : null,
    pending: team.pending_upload
      ? { fileName: team.pending_upload.fileName, size: team.pending_upload.size, startedAt: team.pending_upload.startedAt }
      : null,
  }
}

async function findTeam(repo, body) {
  if (body.code !== undefined && body.code !== null && body.code !== '') {
    const code = cleanText(body.code, 16).toUpperCase().replace(/\s+/g, '')
    if (!TEAM_CODE_PATTERN.test(code)) throw new HttpError(400, 'INVALID_CODE')
    const team = await repo.getTeamByCode(code)
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    return team
  }
  if (body.mobile) {
    const parsed = parseMemberEntry({ number: body.mobile, country: body.country })
    if (!parsed.ok) throw new HttpError(400, 'INVALID_MOBILE')
    const team = await repo.getTeamByMobileKey(parsed.key)
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    return team
  }
  throw new HttpError(400, 'INVALID_REQUEST')
}

async function assertMember(repo, team, mobile, country) {
  const parsed = parseMemberEntry({ number: mobile, country })
  if (!parsed.ok) throw new HttpError(400, 'INVALID_MOBILE')
  const member = (await repo.listMembers(team.id)).find(row => row.mobile_key === parsed.key)
  if (!member) throw new HttpError(403, 'NOT_A_MEMBER')
  return member
}

function requirePending(team, uploadId) {
  const pending = team.pending_upload
  const id = cleanText(uploadId, 64)
  if (!pending || !id || pending.uploadId !== id) throw new HttpError(404, 'UPLOAD_NOT_FOUND')
  return pending
}

/* ─── الفيديو والموافقة ─── */
const MIME_BY_EXT = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo' }
function validateVideo(video, maxBytes) {
  if (!video || typeof video !== 'object') throw new HttpError(400, 'INVALID_VIDEO')
  const fileName = cleanText(video.fileName, 180)
  const size = Number(video.size)
  const mimeType = cleanText(video.mimeType, 80).toLowerCase()
  const title = cleanText(video.title, 80)
  if (!fileName || !isVideoFile(fileName, mimeType)) throw new HttpError(400, 'INVALID_VIDEO_TYPE')
  if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, 'INVALID_VIDEO')
  if (size > maxBytes) throw new HttpError(413, 'VIDEO_TOO_LARGE', { maxBytes })
  if (title.length < 2) throw new HttpError(400, 'INVALID_TITLE')
  const ext = videoExtension(fileName, mimeType)
  return { fileName, size, title, ext, mimeType: /^video\//.test(mimeType) ? mimeType : MIME_BY_EXT[ext] || 'video/mp4' }
}

// ملف الإقرار الموقّع: PDF أو صورة، حتى 15 ميغابايت
function validateConsentFile(file) {
  if (!file || typeof file !== 'object') throw new HttpError(400, 'INVALID_CONSENT_FILE')
  const fileName = cleanText(file.fileName, 180)
  const size = Number(file.size)
  const mimeType = cleanText(file.mimeType, 80).toLowerCase()
  const ext = consentExtension(fileName, mimeType)
  if (!fileName || !ext) throw new HttpError(400, 'INVALID_CONSENT_FILE')
  if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, 'INVALID_CONSENT_FILE')
  if (size > CONSENT_MAX_BYTES) throw new HttpError(413, 'CONSENT_TOO_LARGE', { maxBytes: CONSENT_MAX_BYTES })
  return { fileName, size, ext, mimeType: consentMime(ext) }
}

// مسار الكائن داخل الحاوية بأحرف ASCII فقط؛ الاسم العربي المقروء يُحفظ في قاعدة البيانات ويُستخدم عند التنزيل.
function objectPath(team, ext, nowMs) {
  return `${team.track}/${team.code}/${team.code}-${nowMs.toString(36)}.${ext}`
}
function consentPrefix(team) { return `consents/${team.track}/${team.code}/` }
function consentObjectPath(team, position, ext, nowMs) {
  return `${consentPrefix(team)}${team.code}-${position}-${nowMs.toString(36)}.${ext}`
}

// إنشاء فريق جديد من بيانات النموذج (يُستخدم في register)
async function createTeam(repo, teamInput) {
  const name = cleanText(teamInput.name, 60)
  if (name.length < 2) throw new HttpError(400, 'INVALID_TEAM_NAME')
  const track = String(teamInput.track || '')
  if (!TRACKS.includes(track)) throw new HttpError(400, 'INVALID_TRACK')
  const members = await resolveMembers(repo, teamInput.mobiles)
  const bad = members.find(member => member.status !== 'ok')
  if (bad) {
    const code = { invalid: 'INVALID_MOBILE', not_registered: 'NOT_REGISTERED', in_team: 'MOBILE_TAKEN' }[bad.status]
    throw new HttpError(bad.status === 'in_team' ? 409 : 400, code, { mobile: bad.input, ...(bad.team_code ? { teamCode: bad.team_code } : {}) })
  }
  const names = new Set()
  for (const member of members) {
    if (names.has(member.name_key)) throw new HttpError(400, 'DUPLICATE_MEMBER', { mobile: member.input })
    names.add(member.name_key)
  }
  const team = await repo.registerTeam({
    name, nameKey: teamNameKey(name), track,
    members: members.map(member => ({ mobile: member.stored, mobile_key: member.key, name_key: member.name_key, full_name: member.full_name, registration_id: member.registration.id })),
  })
  await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'team_created', detail: { track, members: members.length } })
  return team
}

// الفريق والعضو المستهدف بالإقرار، بعد التحقق من أن الطالب عضو في الفريق
async function consentTarget(repo, body) {
  const team = await findTeam(repo, { code: body.code })
  const requester = await assertMember(repo, team, body.mobile, body.country)
  const members = await repo.listMembers(team.id)
  const member = members.find(row => row.id === cleanText(body.memberId, 64))
  if (!member) throw new HttpError(404, 'MEMBER_NOT_FOUND')
  return { team, requester, member, position: members.indexOf(member) + 1 }
}

function uploadInfo(pending, team, storage) {
  return {
    // عنوان الرفع إعداد حالي للسيرفر لا حالة للجلسة: لو تغيّر لا تتعطل جلسة معلّقة بعنوان قديم.
    uploadId: pending.uploadId, endpoint: storage.uploadEndpoint, bucket: pending.bucket || storage.bucket, objectPath: pending.objectPath, token: pending.token,
    chunkSize: CHUNK_SIZE, fileName: pending.fileName, displayName: pending.displayName, size: pending.size, mimeType: pending.mimeType,
    replaces: Boolean(pending.replaces), teamCode: team.code, expiresAt: pending.expiresAt,
  }
}

async function verifyUploaded(storage, pending) {
  const info = await storage.info(pending.objectPath)
  if (!info) return { complete: false, found: false }
  if (info.size !== null && info.size !== pending.size) return { complete: false, found: true, size: info.size }
  return { complete: true, found: true, info }
}

/* ─── الأدمن ─── */
async function defaultVerifyAdmin(token) {
  const sb = serviceClient()
  if (!sb) return null
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: row, error: adminError } = await sb.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle()
  if (adminError || !row) return null
  return { id: data.user.id, email: data.user.email || '' }
}

async function requireAdmin(ctx) {
  const token = String(ctx.req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token.length > 4096) throw new HttpError(401, 'UNAUTHORIZED')
  const admin = await ctx.verifyAdmin(token)
  if (!admin) throw new HttpError(403, 'FORBIDDEN')
  return admin
}

// قرار المنظّمة على الفيديو. القرار مربوط بمسار الفيديو الذي اتُّخذ عليه: إذا استُبدل الفيديو أو حُذف عاد الفريق إلى «بلا قرار»
// مع الإشارة إلى القرار السابق، حتى لا يبقى في قائمة المتأهلين فيديو لم تشاهده المنظّمة.
function reviewView(team) {
  const stored = REVIEW_STATUSES.includes(team.review_status) ? team.review_status : 'pending'
  const applies = stored !== 'pending' && Boolean(team.video_file_id) && team.review_video === team.video_file_id
  return {
    status: applies ? stored : 'pending',
    at: applies ? team.review_at || null : null,
    by: applies ? team.review_by || null : null,
    previous: !applies && stored !== 'pending' ? stored : null,
  }
}

// PostgREST (PGRST204 / 42703) أو Postgres مباشرة: أعمدة القرار غير موجودة لأن ملف review-2026-11-12.sql لم يُشغَّل بعد.
function isMissingReviewColumn(error) {
  const code = String(error?.code || '')
  return (code === 'PGRST204' || code === '42703') && /review_/.test(String(error?.message || '') + String(error?.details || ''))
}

function adminConsentView(row) {
  return row ? { id: row.id, nationalId: row.national_id, fileName: row.file_name, path: row.file_id, size: Number(row.file_size) || 0, mimeType: row.file_mime, uploadedAt: row.uploaded_at, uploadedBy: row.uploaded_by } : null
}

function adminTeamView(team, consents) {
  const inPerson = team.members.filter(member => member.in_person).length
  const type = team.members.length === 0 || inPerson === 0 ? 'online' : inPerson === team.members.length ? 'inperson' : 'mixed'
  const rows = consents.rows.filter(row => row.team_id === team.id)
  return {
    id: team.id, code: team.code, name: team.name, track: team.track, trackLabel: TRACK_LABELS[team.track], type, createdAt: team.created_at,
    members: team.members.map(member => ({
      id: member.id, name: member.full_name, mobile: member.mobile, leader: Boolean(member.is_leader), inPerson: Boolean(member.in_person),
      consent: adminConsentView(rows.find(row => row.member_id === member.id)),
    })),
    consents: consentSummary(team.members, { ready: consents.ready, rows }),
    video: team.video_file_id
      ? { path: team.video_file_id, name: team.video_name, title: team.video_title, size: Number(team.video_size), mimeType: team.video_mime, uploadedAt: team.video_uploaded_at, consentVersion: team.consent_version, consentAt: team.consent_at }
      : null,
    pending: team.pending_upload ? { fileName: team.pending_upload.fileName, size: team.pending_upload.size, startedAt: team.pending_upload.startedAt } : null,
    review: reviewView(team),
  }
}

const ACTIONS = {
  async config({ repo, storage }) {
    const settings = await loadSettings(repo)
    return { open: settings.open, deadline: settings.deadline, maxBytes: settings.maxBytes, uploadReady: Boolean(storage), chunkSize: CHUNK_SIZE, consentForm: CONSENT_FORM_VERSION, consentMaxBytes: CONSENT_MAX_BYTES, consentsReady: await repo.hasConsentsTable(), maxMembers: MAX_MEMBERS }
  },

  async lookup({ repo, body }) {
    const members = await resolveMembers(repo, body.mobiles)
    return {
      results: members.map(member => ({
        input: member.input, status: member.status,
        ...(member.full_name ? { name: member.full_name } : {}),
        ...(member.ok ? { mobile: member.stored } : {}),
      })),
    }
  },

  async team({ repo, body }) {
    const team = await findTeam(repo, body)
    return { team: await teamCard(repo, team) }
  },

  // الخطوة الأولى لفريق جديد: التسجيل فقط (بلا فيديو)، ثم ترفع إقرارات الأعضاء، ثم الفيديو.
  async register({ repo, body, nowMs }) {
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const team = await createTeam(repo, body.team && typeof body.team === 'object' ? body.team : {})
    return { team: await teamCard(repo, team), created: true }
  },

  /* ─── إقرار العضو الموقّع: يطلب رابط رفع موقّعًا لمسار واحد ثم يؤكد بعد الرفع ─── */
  async consent_start({ repo, body, storage, nowMs }) {
    const nationalId = normalizeNationalId(body.nationalId)
    if (!nationalId) throw new HttpError(400, 'INVALID_NATIONAL_ID')
    const file = validateConsentFile(body.file)
    const { team, member, position } = await consentTarget(repo, body)
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    if (!(await repo.hasConsentsTable())) throw new HttpError(503, 'CONSENTS_NOT_MIGRATED')
    const path = consentObjectPath(team, position, file.ext, nowMs)
    const token = await storage.signUpload(path)
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'consent_upload_started', file_id: path, file_name: file.fileName, file_size: file.size, detail: { member: member.full_name } })
    return { upload: { objectPath: path, uploadUrl: storage.signedUploadUrl(path, token), mimeType: file.mimeType, size: file.size, expiresAt: iso(nowMs + SIGNED_UPLOAD_TTL_MS) }, member: { id: member.id, name: member.full_name } }
  },

  async consent_complete({ repo, body, storage, nowMs }) {
    const nationalId = normalizeNationalId(body.nationalId)
    if (!nationalId) throw new HttpError(400, 'INVALID_NATIONAL_ID')
    const { team, requester, member } = await consentTarget(repo, body)
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    const path = cleanText(body.objectPath, 200)
    const ext = consentExtension(path, '')
    if (!path.startsWith(consentPrefix(team)) || !ext || /\.\./.test(path)) throw new HttpError(400, 'INVALID_CONSENT_FILE')
    const info = await storage.info(path)
    if (!info) throw new HttpError(409, 'UPLOAD_INCOMPLETE')
    if (info.size !== null && (info.size <= 0 || info.size > CONSENT_MAX_BYTES)) throw new HttpError(413, 'CONSENT_TOO_LARGE', { maxBytes: CONSENT_MAX_BYTES })
    let previous = null
    try { previous = (await repo.listConsents(team.id)).find(row => row.member_id === member.id) || null } catch (error) { if (isMissingConsentsTable(error)) throw new HttpError(503, 'CONSENTS_NOT_MIGRATED'); throw error }
    const row = await repo.upsertConsent({
      team_id: team.id, member_id: member.id, full_name: member.full_name, national_id: nationalId, mobile: member.mobile,
      file_id: path, file_name: consentFileName(team.code, member.full_name, ext), file_size: info.size ?? null, file_mime: consentMime(ext), uploaded_by: requester.mobile_key, uploaded_at: iso(nowMs),
    })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'consent_uploaded', file_id: path, file_name: row.file_name, file_size: info.size ?? null, detail: { member: member.full_name, replaced: previous?.file_id || null } })
    if (previous && previous.file_id !== path) {
      try { await storage.remove([previous.file_id]) } catch { /* يبقى الملف القديم يتيمًا في الحاوية ولا يؤثر */ }
    }
    return { team: await teamCard(repo, team), consent: { memberId: member.id, fileName: row.file_name, uploadedAt: row.uploaded_at } }
  },

  // بدء رفع الفيديو لفريق مسجّل. شرطه: إقرار موقّع لكل عضو (إن كان جدول الإقرارات مفعّلًا).
  async start(ctx) {
    const { repo, body, nowMs, storage } = ctx
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const video = validateVideo(body.video, settings.maxBytes)
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')

    const teamInput = body.team && typeof body.team === 'object' ? body.team : {}
    if (teamInput.mode !== 'existing') throw new HttpError(400, 'INVALID_REQUEST')
    let team = await findTeam(repo, { code: teamInput.code })
    await assertMember(repo, team, teamInput.mobile, teamInput.country)
    const members = await repo.listMembers(team.id)
    const consents = await loadConsents(repo, team.id)
    if (consents.ready) {
      const missing = members.filter(member => !consents.rows.some(row => row.member_id === member.id)).map(member => member.full_name)
      if (missing.length) throw new HttpError(409, 'CONSENTS_MISSING', { missing })
    }

    const pending = team.pending_upload
    if (pending && pending.fileName === video.fileName && pending.size === video.size && pending.token && Date.parse(pending.startedAt) > nowMs - SESSION_REUSE_MS) {
      return { team: await teamCard(repo, team), created: false, upload: uploadInfo(pending, team, storage) }
    }
    const path = objectPath(team, video.ext, nowMs)
    const token = await storage.signUpload(path)
    const upload = {
      uploadId: randomBytes(16).toString('hex'), objectPath: path, token, bucket: storage.bucket, endpoint: storage.uploadEndpoint,
      fileName: video.fileName, displayName: driveFileName(team.code, team.name, video.title, video.ext), size: video.size, mimeType: video.mimeType, title: video.title,
      startedAt: iso(nowMs), expiresAt: iso(nowMs + SIGNED_UPLOAD_TTL_MS), consent: { version: CONSENT_FORM_VERSION, members: consents.rows.length }, replaces: team.video_file_id || null,
    }
    team = await repo.updateTeam(team.id, { pending_upload: upload })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_started', file_id: path, file_name: upload.displayName, file_size: video.size, detail: { uploadId: upload.uploadId, replaces: upload.replaces } })
    return { team: await teamCard(repo, team), created: false, upload: uploadInfo(upload, team, storage) }
  },

  async status({ repo, body, storage }) {
    const team = await findTeam(repo, { code: body.code })
    const pending = requirePending(team, body.uploadId)
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    const state = await verifyUploaded(storage, pending)
    return { complete: state.complete, found: state.found, size: state.complete ? pending.size : state.size ?? 0, expired: Date.parse(pending.expiresAt || 0) < Date.now() }
  },

  async complete({ repo, body, storage, nowMs }) {
    const team = await findTeam(repo, { code: body.code })
    const pending = requirePending(team, body.uploadId)
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    const state = await verifyUploaded(storage, pending)
    if (!state.complete) throw new HttpError(409, state.found ? 'UPLOAD_SIZE_MISMATCH' : 'UPLOAD_INCOMPLETE', { expected: pending.size, actual: state.size ?? 0 })

    const previous = team.video_file_id && team.video_file_id !== pending.objectPath ? team.video_file_id : null
    const updated = await repo.updateTeam(team.id, {
      video_file_id: pending.objectPath, video_name: pending.displayName, video_title: pending.title, video_size: pending.size, video_mime: pending.mimeType,
      video_md5: null, video_web_link: null, video_uploaded_at: iso(nowMs),
      consent_version: pending.consent?.version || CONSENT_FORM_VERSION, consent_lang: null, consent_at: iso(nowMs),
      pending_upload: null,
    })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_completed', file_id: pending.objectPath, file_name: pending.displayName, file_size: pending.size, detail: { uploadId: pending.uploadId, replaced: previous } })
    if (previous) {
      try {
        await storage.remove([previous])
        await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'previous_removed', file_id: previous })
      } catch (error) {
        await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'previous_remove_failed', file_id: previous, detail: { code: error.code || 'ERROR' } })
      }
    }
    return { team: await teamCard(repo, updated) }
  },

  async cancel({ repo, body }) {
    const team = await findTeam(repo, { code: body.code })
    if (team.pending_upload && team.pending_upload.uploadId === cleanText(body.uploadId, 64)) {
      await repo.updateTeam(team.id, { pending_upload: null })
      await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_cancelled', file_id: team.pending_upload.objectPath, file_name: team.pending_upload.displayName, detail: { uploadId: team.pending_upload.uploadId } })
    }
    return {}
  },

  // تعديل اسم الفريق فقط (الكود والمسار والأعضاء ثابتة). متاح لأي عضو في الفريق ما دام التسليم مفتوحًا.
  async rename_team({ repo, body, nowMs }) {
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const team = await findTeam(repo, { code: body.code })
    const member = await assertMember(repo, team, body.mobile, body.country)
    const name = cleanText(body.name, 60)
    if (name.length < 2) throw new HttpError(400, 'INVALID_TEAM_NAME')
    if (name === team.name) return { team: await teamCard(repo, team), renamed: false }
    const extOf = path => (/\.([a-z0-9]{2,5})$/i.exec(String(path || '')) || [])[1]?.toLowerCase() || 'mp4'
    const patch = { name, name_key: teamNameKey(name) }
    // اسم ملف الفيديو المقروء (عند التنزيل) يحمل اسم الفريق، فيتبع الاسم الجديد
    if (team.video_file_id) patch.video_name = driveFileName(team.code, name, team.video_title, extOf(team.video_file_id))
    if (team.pending_upload) patch.pending_upload = { ...team.pending_upload, displayName: driveFileName(team.code, name, team.pending_upload.title, extOf(team.pending_upload.objectPath)) }
    let updated
    try {
      updated = await repo.updateTeam(team.id, patch)
    } catch (error) {
      if (error?.code === '23505' || /tb_teams_name_key_key/.test(`${error?.message || ''} ${error?.details || ''}`)) throw new HttpError(409, 'TEAM_NAME_TAKEN')
      throw error
    }
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'team_renamed', detail: { from: team.name, to: name, by: member.full_name } })
    return { team: await teamCard(repo, updated), renamed: true }
  },

  async remove_video({ repo, body, storage, nowMs }) {
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const team = await findTeam(repo, { code: body.code })
    const member = await assertMember(repo, team, body.mobile, body.country)
    if (!member.is_leader) throw new HttpError(403, 'LEADER_ONLY')
    if (!team.video_file_id) return { team: await teamCard(repo, team) }
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    let removed = false
    try { removed = await storage.remove([team.video_file_id]) } catch { removed = false }
    const updated = await repo.updateTeam(team.id, { video_file_id: null, video_name: null, video_title: null, video_size: null, video_mime: null, video_md5: null, video_web_link: null, video_uploaded_at: null })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'video_removed', file_id: team.video_file_id, file_name: team.video_name, detail: { removed } })
    return { team: await teamCard(repo, updated) }
  },

  /* ─── إجراءات الأدمن (جلسة Supabase لمستخدم في admin_users) ─── */
  async admin_overview({ repo, storage }) {
    const settings = await loadSettings(repo)
    let consents
    try { consents = { ready: true, rows: await repo.listAllConsents() } } catch (error) { if (!isMissingConsentsTable(error)) throw error; consents = { ready: false, rows: [] } }
    const teams = (await repo.listTeamsWithMembers()).map(team => adminTeamView(team, consents))
    const usedBytes = teams.reduce((sum, team) => sum + (team.video ? team.video.size : 0), 0)
    const withVideo = teams.filter(team => team.video)
    return {
      settings, teams,
      storage: { configured: Boolean(storage), bucket: storage?.bucket || null, usedBytes, includedBytes: INCLUDED_STORAGE_BYTES },
      review: { ready: await repo.hasReviewColumns() },
      consents: { ready: consents.ready, files: consents.rows.length, bytes: consents.rows.reduce((sum, row) => sum + (Number(row.file_size) || 0), 0) },
      stats: {
        teams: teams.length, withVideo: withVideo.length, members: teams.reduce((sum, team) => sum + team.members.length, 0),
        qualified: withVideo.filter(team => team.review.status === 'qualified').length,
        rejected: withVideo.filter(team => team.review.status === 'rejected').length,
        undecided: withVideo.filter(team => team.review.status === 'pending').length,
        consentFiles: consents.rows.length,
        consentsComplete: consents.ready ? teams.filter(team => team.consents.done === team.consents.required).length : 0,
        consentsMissing: consents.ready ? teams.reduce((sum, team) => sum + (team.consents.required - team.consents.done), 0) : 0,
        inperson: await repo.countInperson(), registrations: await repo.countRegistrations(),
      },
    }
  },

  // روابط مؤقتة (ساعة) لملفات الإقرارات: ملف واحد أو دفعة لتنزيلها معًا
  async admin_consent_urls({ repo, body, storage }) {
    const ids = (Array.isArray(body.consentIds) ? body.consentIds : [body.consentId]).map(id => cleanText(id, 64)).filter(Boolean)
    if (!ids.length || ids.length > CONSENT_URL_BATCH) throw new HttpError(400, 'INVALID_REQUEST')
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    let rows
    try { rows = await repo.listConsentsByIds(ids) } catch (error) { if (isMissingConsentsTable(error)) throw new HttpError(503, 'CONSENTS_NOT_MIGRATED'); throw error }
    if (!rows.length) throw new HttpError(404, 'CONSENT_NOT_FOUND')
    const files = []
    for (const row of rows) {
      files.push({ id: row.id, fileName: row.file_name, mimeType: row.file_mime, size: Number(row.file_size) || 0, url: await storage.signedViewUrl(row.file_id, VIEW_URL_SECONDS), downloadUrl: await storage.signedViewUrl(row.file_id, VIEW_URL_SECONDS, row.file_name) })
    }
    return { files, expiresIn: VIEW_URL_SECONDS }
  },

  async admin_settings({ repo, body }) {
    const current = (await repo.readSetting('submissions')) || {}
    const next = { ...current }
    if (typeof body.open === 'boolean') next.open = body.open
    if (body.deadline === null || body.deadline === '') next.deadline = null
    else if (typeof body.deadline === 'string') {
      if (!Number.isFinite(Date.parse(body.deadline))) throw new HttpError(400, 'INVALID_DEADLINE')
      next.deadline = new Date(body.deadline).toISOString()
    }
    if (body.maxBytes !== undefined) {
      const maxBytes = Number(body.maxBytes)
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 * 1024 || maxBytes > 50 * 1024 * 1024 * 1024) throw new HttpError(400, 'INVALID_MAX_BYTES')
      next.max_bytes = maxBytes
    }
    await repo.writeSetting('submissions', next)
    return { settings: await loadSettings(repo) }
  },

  // رابط مشاهدة أو تنزيل مؤقت (ساعة) للمنظّمة فقط
  async admin_video_url({ repo, body, storage }) {
    const team = await repo.getTeamById(cleanText(body.teamId, 64))
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    if (!team.video_file_id) throw new HttpError(404, 'VIDEO_NOT_FOUND')
    if (!storage) throw new HttpError(503, 'STORAGE_NOT_CONFIGURED')
    const url = await storage.signedViewUrl(team.video_file_id, VIEW_URL_SECONDS)
    const downloadUrl = await storage.signedViewUrl(team.video_file_id, VIEW_URL_SECONDS, team.video_name || 'video.mp4')
    return { url, downloadUrl, expiresIn: VIEW_URL_SECONDS }
  },

  // قرار المنظّمة على فيديو الفريق: qualified / rejected، أو pending للتراجع. لا يصل منه شيء إلى المشاركين.
  async admin_review({ repo, body, admin, nowMs }) {
    const status = String(body.status || '')
    if (!REVIEW_STATUSES.includes(status)) throw new HttpError(400, 'INVALID_REVIEW')
    const team = await repo.getTeamById(cleanText(body.teamId, 64))
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    if (status !== 'pending' && !team.video_file_id) throw new HttpError(409, 'VIDEO_NOT_FOUND')
    const patch = status === 'pending'
      ? { review_status: 'pending', review_at: null, review_by: null, review_video: null }
      : { review_status: status, review_at: iso(nowMs), review_by: admin.email || admin.id, review_video: team.video_file_id }
    let updated
    try {
      updated = await repo.updateTeam(team.id, patch)
    } catch (error) {
      if (isMissingReviewColumn(error)) throw new HttpError(503, 'REVIEW_NOT_MIGRATED')
      throw error
    }
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: `review_${status}`, file_id: team.video_file_id, file_name: team.video_name, detail: { by: admin.email || admin.id, previous: reviewView(team) } })
    return { review: reviewView(updated) }
  },

  async admin_delete_team({ repo, body, storage }) {
    const team = await repo.getTeamById(cleanText(body.teamId, 64))
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    const consents = await loadConsents(repo, team.id)
    const paths = [team.video_file_id, ...consents.rows.map(row => row.file_id)].filter(Boolean)
    if (paths.length && storage) {
      try { await storage.remove(paths) } catch { /* نسجّل ونكمل */ }
    }
    await repo.logUpload({ team_id: null, team_code: team.code, action: 'team_deleted_by_admin', file_id: team.video_file_id, file_name: team.video_name, detail: { name: team.name, track: team.track } })
    await repo.deleteTeam(team.id)
    return {}
  },

  async admin_remove_member({ repo, body, storage }) {
    const member = await repo.getMember(cleanText(body.memberId, 64))
    if (!member) throw new HttpError(404, 'MEMBER_NOT_FOUND')
    const members = await repo.listMembers(member.team_id)
    if (members.length <= 1) throw new HttpError(409, 'LAST_MEMBER')
    const consents = await loadConsents(repo, member.team_id)
    const consent = consents.rows.find(row => row.member_id === member.id)
    await repo.removeMember(member.id)
    if (consent && storage) { try { await storage.remove([consent.file_id]) } catch { /* يبقى يتيمًا */ } }
    const team = await repo.getTeamById(member.team_id)
    await repo.logUpload({ team_id: member.team_id, team_code: team?.code || null, action: 'member_removed_by_admin', detail: { name: member.full_name, mobile: member.mobile } })
    return {}
  },
}

export function createHandler(deps = {}) {
  const getRepo = deps.repo ? () => deps.repo : () => { const sb = serviceClient(); return sb ? supabaseRepo(sb) : null }
  let storageInstance = deps.storage === undefined ? null : deps.storage
  const getStorage = () => {
    if (deps.storage !== undefined) return deps.storage
    if (storageInstance) return storageInstance
    const config = storageConfig()
    storageInstance = config ? createStorage(config) : null
    return storageInstance
  }
  const now = deps.now || Date.now
  const verifyAdmin = deps.verifyAdmin || defaultVerifyAdmin

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' })
    }
    if (!originAllowed(req)) return json(res, 403, { ok: false, code: 'NOT_ALLOWED' })
    const repo = getRepo()
    if (!repo) return json(res, 503, { ok: false, code: 'DB_NOT_CONFIGURED' })
    const nowMs = now()
    if (!withinRateLimit(clientIp(req), nowMs)) return json(res, 429, { ok: false, code: 'RATE_LIMITED' })
    let body
    try { body = parseBody(req) } catch (error) { return json(res, error instanceof HttpError ? error.status : 400, { ok: false, code: error instanceof HttpError ? error.code : 'INVALID_REQUEST' }) }
    if (!body || typeof body !== 'object') return json(res, 400, { ok: false, code: 'INVALID_REQUEST' })
    const action = String(body.action || '')
    const run = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null
    if (!run) return json(res, 400, { ok: false, code: 'UNKNOWN_ACTION' })
    try {
      const ctx = { repo, storage: getStorage(), nowMs, req, body, verifyAdmin }
      if (action.startsWith('admin_')) ctx.admin = await requireAdmin(ctx)
      const result = await run(ctx)
      return json(res, 200, { ok: true, ...result })
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { ok: false, code: error.code, ...error.extra })
      if (error instanceof RegisterTeamError) return json(res, 409, { ok: false, code: error.code, mobileKey: error.mobileKey })
      if (error instanceof StorageError) return json(res, error.status || 502, { ok: false, code: error.code })
      if (error instanceof DbError) return json(res, 503, { ok: false, code: 'DB_UNAVAILABLE' })
      console.error('[submissions]', error)
      return json(res, 500, { ok: false, code: 'SERVER_ERROR' })
    }
  }
}
