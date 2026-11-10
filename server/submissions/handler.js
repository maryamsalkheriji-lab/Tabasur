// /api/submissions: تسجيل الفرق ورفع فيديو واحد لكل فريق إلى Google Drive المنظّمة.
// المتصفح لا يرى درايف أبدًا: السيرفر يفتح جلسة رفع ويعطيه رابطها، ثم يتحقق من الملف بعد الاكتمال.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { serviceClient, DbError } from './db.js'
import { supabaseRepo, RegisterTeamError } from './repo.js'
import { createDriveClient, buildAuthUrl, exchangeCode, emailFromIdToken, DriveError } from './drive.js'
import {
  TRACKS, TRACK_LABELS, TRACK_FOLDER_NAMES, ROOT_FOLDER_NAME, MAX_MEMBERS, TEAM_CODE_PATTERN,
  parseMobile, nameKey, teamNameKey, cleanText, videoExtension, isVideoFile, driveFileName,
} from './keys.js'
import { PUBLICATION_POLICY } from '../../src/lib/remote-camp.js'

export const CHUNK_SIZE = 8 * 1024 * 1024 // مضاعف 256 كيلوبايت كما يطلب Google
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024
const SESSION_REUSE_MS = 6 * 24 * 60 * 60 * 1000 // جلسة Google تصلح أسبوعًا؛ نعيد استخدامها حتى ستة أيام
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000
const MAX_BODY_BYTES = 16384
const RATE_LIMIT_PER_MINUTE = 90
const LANGS = ['ar', 'en']

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

function siteUrl(req) {
  if (process.env.VERCEL_ENV === 'production') return (process.env.PUBLIC_SITE_URL || 'https://cubex.com.sa').replace(/\/$/, '')
  const origin = req.headers?.origin
  if (origin) { try { return new URL(origin).origin } catch { /* نكمل */ } }
  const host = req.headers?.host || 'localhost:5173'
  return `${/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https'}://${host}`
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

/* ─── درايف ─── */
async function driveFor(repo, fetchImpl) {
  const auth = await repo.readSecret('drive_oauth')
  if (!auth?.refresh_token) throw new HttpError(503, 'DRIVE_NOT_CONNECTED')
  return { drive: createDriveClient(auth, fetchImpl), auth }
}

async function ensureFolders(repo, drive, auth, nowMs) {
  const current = await repo.readSetting('drive_folders')
  if (current?.account === (auth.email || '') && current?.root?.id && TRACKS.every(track => current.tracks?.[track])) return current
  const root = await drive.createFolder(ROOT_FOLDER_NAME)
  const tracks = {}
  for (const track of TRACKS) tracks[track] = (await drive.createFolder(TRACK_FOLDER_NAMES[track], root.id)).id
  const folders = { account: auth.email || '', root: { id: root.id, link: root.webViewLink || null }, tracks, created_at: iso(nowMs) }
  await repo.writeSetting('drive_folders', folders)
  return folders
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

async function teamCard(repo, team) {
  const members = await repo.listMembers(team.id)
  return {
    code: team.code, name: team.name, track: team.track, trackLabel: TRACK_LABELS[team.track], createdAt: team.created_at,
    members: members.map(member => ({ name: member.full_name, mobile: maskMobile(member.mobile), leader: Boolean(member.is_leader) })),
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
  return { fileName, size, title, mimeType: /^video\//.test(mimeType) ? mimeType : MIME_BY_EXT[ext] || 'video/mp4' }
}

function validateConsent(consent) {
  if (!consent || consent.accepted !== true) throw new HttpError(400, 'CONSENT_REQUIRED')
  if (consent.version !== PUBLICATION_POLICY.version) throw new HttpError(409, 'CONSENT_OUTDATED', { version: PUBLICATION_POLICY.version })
  return { version: PUBLICATION_POLICY.version, lang: LANGS.includes(consent.lang) ? consent.lang : 'ar' }
}

function uploadInfo(pending, team) {
  return {
    uploadId: pending.uploadId, sessionUri: pending.sessionUri, chunkSize: CHUNK_SIZE,
    fileName: pending.fileName, driveName: pending.driveName, size: pending.size, replaces: Boolean(pending.replaces), teamCode: team.code,
  }
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

function adminTeamView(team) {
  const inPerson = team.members.filter(member => member.in_person).length
  const type = team.members.length === 0 ? 'online' : inPerson === 0 ? 'online' : inPerson === team.members.length ? 'inperson' : 'mixed'
  return {
    id: team.id, code: team.code, name: team.name, track: team.track, trackLabel: TRACK_LABELS[team.track], type, createdAt: team.created_at,
    members: team.members.map(member => ({ id: member.id, name: member.full_name, mobile: member.mobile, leader: Boolean(member.is_leader), inPerson: Boolean(member.in_person) })),
    video: team.video_file_id
      ? { fileId: team.video_file_id, name: team.video_name, title: team.video_title, size: Number(team.video_size), uploadedAt: team.video_uploaded_at, link: team.video_web_link, md5: team.video_md5, consentVersion: team.consent_version, consentAt: team.consent_at }
      : null,
    pending: team.pending_upload ? { fileName: team.pending_upload.fileName, size: team.pending_upload.size, startedAt: team.pending_upload.startedAt } : null,
  }
}

const ACTIONS = {
  async config({ repo }) {
    const settings = await loadSettings(repo)
    const auth = await repo.readSecret('drive_oauth')
    return { open: settings.open, deadline: settings.deadline, maxBytes: settings.maxBytes, driveReady: Boolean(auth?.refresh_token), chunkSize: CHUNK_SIZE, policyVersion: PUBLICATION_POLICY.version, maxMembers: MAX_MEMBERS }
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

  async start(ctx) {
    const { repo, body, nowMs, fetchImpl } = ctx
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const video = validateVideo(body.video, settings.maxBytes)
    const consent = validateConsent(body.consent)
    const { drive, auth } = await driveFor(repo, fetchImpl) // قبل إنشاء أي فريق حتى لا نسجّل فرقًا ودرايف معطّل
    const folders = await ensureFolders(repo, drive, auth, nowMs)

    const teamInput = body.team && typeof body.team === 'object' ? body.team : {}
    let team, created = false
    if (teamInput.mode === 'existing') {
      team = await findTeam(repo, { code: teamInput.code })
      await assertMember(repo, team, teamInput.mobile, teamInput.country)
    } else {
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
      team = await repo.registerTeam({
        name, nameKey: teamNameKey(name), track,
        members: members.map(member => ({ mobile: member.stored, mobile_key: member.key, name_key: member.name_key, full_name: member.full_name, registration_id: member.registration.id })),
      })
      created = true
      await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'team_created', detail: { track, members: members.length } })
    }

    const pending = team.pending_upload
    if (pending && pending.fileName === video.fileName && pending.size === video.size && Date.parse(pending.startedAt) > nowMs - SESSION_REUSE_MS) {
      return { team: await teamCard(repo, team), created, upload: uploadInfo(pending, team) }
    }
    const ext = videoExtension(video.fileName, video.mimeType)
    const driveName = driveFileName(team.code, team.name, video.title, ext)
    let sessionUri
    try {
      sessionUri = await drive.createResumableSession({ name: driveName, mimeType: video.mimeType, size: video.size, parentId: folders.tracks[team.track], appProperties: { teamCode: team.code, track: team.track } })
    } catch (error) {
      if (created) throw new HttpError(502, 'DRIVE_SESSION_FAILED', { teamCode: team.code, created: true })
      throw error
    }
    const upload = {
      uploadId: randomBytes(16).toString('hex'), sessionUri, fileName: video.fileName, driveName, size: video.size, mimeType: video.mimeType, title: video.title,
      startedAt: iso(nowMs), consent: { version: consent.version, lang: consent.lang, acceptedAt: iso(nowMs) }, replaces: team.video_file_id || null,
    }
    team = await repo.updateTeam(team.id, { pending_upload: upload })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_started', file_name: driveName, file_size: video.size, detail: { uploadId: upload.uploadId, replaces: upload.replaces } })
    return { team: await teamCard(repo, team), created, upload: uploadInfo(upload, team) }
  },

  async status({ repo, body, fetchImpl }) {
    const team = await findTeam(repo, { code: body.code })
    const pending = requirePending(team, body.uploadId)
    const { drive } = await driveFor(repo, fetchImpl)
    const state = await drive.queryUpload(pending.sessionUri, pending.size)
    if (state.expired) {
      await repo.updateTeam(team.id, { pending_upload: null })
      throw new HttpError(410, 'UPLOAD_EXPIRED')
    }
    return state.complete ? { complete: true, committed: pending.size, fileId: state.file?.id || null } : { complete: false, committed: state.committed }
  },

  async complete({ repo, body, fetchImpl, nowMs }) {
    const team = await findTeam(repo, { code: body.code })
    const pending = requirePending(team, body.uploadId)
    const { drive } = await driveFor(repo, fetchImpl)
    const fileId = cleanText(body.fileId, 128)
    let file = fileId ? await drive.getFile(fileId) : null
    if (!file) {
      const state = await drive.queryUpload(pending.sessionUri, pending.size)
      if (!state.complete) throw new HttpError(409, 'UPLOAD_INCOMPLETE', { committed: state.committed ?? 0, expired: Boolean(state.expired) })
      file = state.file?.id ? await drive.getFile(state.file.id) : null
    }
    if (!file || file.trashed) throw new HttpError(409, 'UPLOAD_INCOMPLETE', { committed: 0 })
    if (Number(file.size) !== pending.size) throw new HttpError(409, 'UPLOAD_SIZE_MISMATCH', { expected: pending.size, actual: Number(file.size) })
    const folders = await repo.readSetting('drive_folders')
    if (folders?.tracks?.[team.track] && !(file.parents || []).includes(folders.tracks[team.track])) throw new HttpError(409, 'UPLOAD_WRONG_FOLDER')

    const previous = team.video_file_id && team.video_file_id !== file.id ? team.video_file_id : null
    const updated = await repo.updateTeam(team.id, {
      video_file_id: file.id, video_name: file.name, video_title: pending.title, video_size: pending.size, video_mime: pending.mimeType,
      video_md5: file.md5Checksum || null, video_web_link: file.webViewLink || null, video_uploaded_at: iso(nowMs),
      consent_version: pending.consent?.version || PUBLICATION_POLICY.version, consent_lang: pending.consent?.lang || 'ar', consent_at: pending.consent?.acceptedAt || iso(nowMs),
      pending_upload: null,
    })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_completed', file_id: file.id, file_name: file.name, file_size: pending.size, detail: { uploadId: pending.uploadId, md5: file.md5Checksum || null, replaced: previous } })
    if (previous) {
      try {
        await drive.trashFile(previous)
        await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'previous_trashed', file_id: previous })
      } catch (error) {
        await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'previous_trash_failed', file_id: previous, detail: { code: error.code || 'ERROR' } })
      }
    }
    return { team: await teamCard(repo, updated) }
  },

  async cancel({ repo, body }) {
    const team = await findTeam(repo, { code: body.code })
    if (team.pending_upload && team.pending_upload.uploadId === cleanText(body.uploadId, 64)) {
      await repo.updateTeam(team.id, { pending_upload: null })
      await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'upload_cancelled', file_name: team.pending_upload.driveName, detail: { uploadId: team.pending_upload.uploadId } })
    }
    return {}
  },

  async remove_video({ repo, body, fetchImpl, nowMs }) {
    const settings = await loadSettings(repo)
    assertOpen(settings, nowMs)
    const team = await findTeam(repo, { code: body.code })
    const member = await assertMember(repo, team, body.mobile, body.country)
    if (!member.is_leader) throw new HttpError(403, 'LEADER_ONLY')
    if (!team.video_file_id) return { team: await teamCard(repo, team) }
    const { drive } = await driveFor(repo, fetchImpl)
    let trashed = false
    try { trashed = await drive.trashFile(team.video_file_id) } catch { trashed = false }
    const updated = await repo.updateTeam(team.id, { video_file_id: null, video_name: null, video_title: null, video_size: null, video_mime: null, video_md5: null, video_web_link: null, video_uploaded_at: null })
    await repo.logUpload({ team_id: team.id, team_code: team.code, action: 'video_removed', file_id: team.video_file_id, file_name: team.video_name, detail: { trashed } })
    return { team: await teamCard(repo, updated) }
  },

  /* ─── إجراءات الأدمن (جلسة Supabase لمستخدم في admin_users) ─── */
  async admin_overview({ repo, fetchImpl, siteUrl: site, nowMs }) {
    const settings = await loadSettings(repo)
    const auth = await repo.readSecret('drive_oauth')
    const pending = await repo.readSecret('drive_oauth_pending')
    const drive = { connected: false, redirectUri: `${site}/api/drive-oauth`, pendingClientId: pending?.client_id || null }
    if (auth?.refresh_token) {
      Object.assign(drive, { connected: true, email: auth.email || '', connectedAt: auth.connected_at || null, clientId: auth.client_id })
      try {
        const client = createDriveClient(auth, fetchImpl)
        drive.folders = await ensureFolders(repo, client, auth, nowMs)
        const about = await client.about()
        drive.quota = about.storageQuota || null
        drive.account = about.user || null
        drive.ok = true
      } catch (error) {
        drive.ok = false
        drive.error = error.code || 'DRIVE_ERROR'
      }
    }
    const teams = (await repo.listTeamsWithMembers()).map(adminTeamView)
    return {
      settings, drive, teams,
      stats: {
        teams: teams.length, withVideo: teams.filter(team => team.video).length, members: teams.reduce((sum, team) => sum + team.members.length, 0),
        inperson: await repo.countInperson(), registrations: await repo.countRegistrations(),
      },
    }
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

  async admin_drive_begin({ repo, body, siteUrl: site, nowMs }) {
    const clientId = cleanText(body.clientId, 200)
    const clientSecret = String(body.clientSecret || '').trim()
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new HttpError(400, 'INVALID_CLIENT_ID')
    if (clientSecret.length < 10 || clientSecret.length > 200 || /\s/.test(clientSecret)) throw new HttpError(400, 'INVALID_CLIENT_SECRET')
    const state = randomBytes(24).toString('hex')
    const redirectUri = `${site}/api/drive-oauth`
    await repo.writeSecret('drive_oauth_pending', { client_id: clientId, client_secret: clientSecret, state, redirect_uri: redirectUri, created_at: iso(nowMs) })
    return { url: buildAuthUrl({ clientId, redirectUri, state }), redirectUri }
  },

  async admin_drive_disconnect({ repo }) {
    await repo.deleteSecret('drive_oauth')
    await repo.deleteSecret('drive_oauth_pending')
    await repo.writeSetting('drive_folders', {})
    return {}
  },

  async admin_delete_team({ repo, body, fetchImpl }) {
    const team = await repo.getTeamById(cleanText(body.teamId, 64))
    if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
    if (team.video_file_id) {
      try { const { drive } = await driveFor(repo, fetchImpl); await drive.trashFile(team.video_file_id) } catch { /* نسجّل ونكمل */ }
    }
    await repo.logUpload({ team_id: null, team_code: team.code, action: 'team_deleted_by_admin', file_id: team.video_file_id, file_name: team.video_name, detail: { name: team.name, track: team.track } })
    await repo.deleteTeam(team.id)
    return {}
  },

  async admin_remove_member({ repo, body }) {
    const member = await repo.getMember(cleanText(body.memberId, 64))
    if (!member) throw new HttpError(404, 'MEMBER_NOT_FOUND')
    const members = await repo.listMembers(member.team_id)
    if (members.length <= 1) throw new HttpError(409, 'LAST_MEMBER')
    await repo.removeMember(member.id)
    const team = await repo.getTeamById(member.team_id)
    await repo.logUpload({ team_id: member.team_id, team_code: team?.code || null, action: 'member_removed_by_admin', detail: { name: member.full_name, mobile: member.mobile } })
    return {}
  },
}

export function createHandler(deps = {}) {
  const getRepo = deps.repo ? () => deps.repo : () => { const sb = serviceClient(); return sb ? supabaseRepo(sb) : null }
  const fetchImpl = deps.fetch || globalThis.fetch
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
      const ctx = { repo, fetchImpl, nowMs, req, body, siteUrl: siteUrl(req), verifyAdmin }
      if (action.startsWith('admin_')) ctx.admin = await requireAdmin(ctx)
      const result = await run(ctx)
      return json(res, 200, { ok: true, ...result })
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { ok: false, code: error.code, ...error.extra })
      if (error instanceof RegisterTeamError) return json(res, 409, { ok: false, code: error.code, mobileKey: error.mobileKey })
      if (error instanceof DriveError) return json(res, error.status || 502, { ok: false, code: error.code })
      if (error instanceof DbError) return json(res, 503, { ok: false, code: 'DB_UNAVAILABLE' })
      console.error('[submissions]', error)
      return json(res, 500, { ok: false, code: 'SERVER_ERROR' })
    }
  }
}

// GET /api/drive-oauth?code=…&state=… : يستقبل عودة Google بعد موافقة المنظّمة ويحفظ refresh token.
export function createOAuthCallback(deps = {}) {
  const getRepo = deps.repo ? () => deps.repo : () => { const sb = serviceClient(); return sb ? supabaseRepo(sb) : null }
  const fetchImpl = deps.fetch || globalThis.fetch
  const now = deps.now || Date.now
  return async function callback(req, res) {
    const redirect = (status, reason = '') => {
      res.statusCode = 302
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Location', `/admin?tab=submissions&drive=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`)
      res.end()
    }
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end() }
    const repo = getRepo()
    if (!repo) return redirect('error', 'DB_NOT_CONFIGURED')
    try {
      const url = new URL(req.url || '/', 'http://local')
      const providerError = url.searchParams.get('error')
      if (providerError) return redirect('error', cleanText(providerError, 60))
      const code = url.searchParams.get('code') || ''
      const state = url.searchParams.get('state') || ''
      const pending = await repo.readSecret('drive_oauth_pending')
      const expected = Buffer.from(String(pending?.state || ''))
      const received = Buffer.from(state)
      if (!pending || !code || !state || expected.length !== received.length || !timingSafeEqual(expected, received)) return redirect('error', 'STATE_MISMATCH')
      if (Date.parse(pending.created_at) < now() - OAUTH_STATE_TTL_MS) return redirect('error', 'STATE_EXPIRED')
      const tokens = await exchangeCode({ clientId: pending.client_id, clientSecret: pending.client_secret, code, redirectUri: pending.redirect_uri }, fetchImpl)
      const email = emailFromIdToken(tokens.id_token)
      const previous = await repo.readSecret('drive_oauth')
      await repo.writeSecret('drive_oauth', { client_id: pending.client_id, client_secret: pending.client_secret, refresh_token: tokens.refresh_token, scope: tokens.scope || '', email, connected_at: iso(now()) })
      await repo.deleteSecret('drive_oauth_pending')
      if (previous?.refresh_token && (previous.email || '') !== email) await repo.writeSetting('drive_folders', {})
      return redirect('connected')
    } catch (error) {
      return redirect('error', error.code || 'OAUTH_FAILED')
    }
  }
}
