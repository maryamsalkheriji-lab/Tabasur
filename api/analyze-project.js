// ─── تحليل عرض المشروع (PDF/PPTX) بالذكاء الاصطناعي — للأدمن فقط ───
// POST /api/analyze-project  { project_id }  مع ترويسة Authorization: Bearer <جلسة Supabase للأدمن>
// 1) يتحقق من الجلسة ومن وجود المستخدم في jd_admins (بمفتاح service_role على السيرفر فقط)
// 2) يُنزّل الملف من bucket خاص (jd-decks) ويحوّل PPTX إلى نص، ويرسل PDF كمستند
// 3) يطلب من Claude تحليلًا بصيغة JSON ثابتة ويحفظه في jd_projects.ai_analysis / ai_stage / analyzed_at
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { unzipSync, strFromU8 } from 'fflate'

export const config = { maxDuration: 60 }

const BUCKET = 'jd-decks'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_TEXT_CHARS = 60000
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STAGES = ['idea', 'prototype', 'mvp', 'complete']

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['stage', 'stage_reason', 'has_working_product', 'problem_clarity', 'ai_usage', 'strengths', 'gaps', 'questions_for_judges'],
  properties: {
    stage: { type: 'string', enum: STAGES },
    stage_reason: { type: 'string' },
    has_working_product: { type: 'boolean' },
    problem_clarity: { type: 'string' },
    ai_usage: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    questions_for_judges: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM_PROMPT = `أنت محلل تقني يساعد منظّم هاكاثون على فهم مرحلة كل مشروع قبل التحكيم. تقرأ عرض الفريق (شرائح أو مستند) وتستخرج تقييمًا موضوعيًا بالعربية.

تعريف المراحل — اختر واحدة فقط:
- idea (فكرة): لا يوجد شيء يعمل؛ وصف أو تصاميم أو شرائح فقط.
- prototype (نموذج أولي): واجهات أو أجزاء تعمل لكن بلا تدفق كامل من البداية للنتيجة.
- mvp: الوظيفة الأساسية تعمل من البداية للنتيجة ويمكن تجربتها فعليًا.
- complete (مكتمل): MVP مختبَر ومستقر وجاهز للاستخدام الفعلي.

قواعد:
- اعتمد على ما يُثبته العرض فعليًا (لقطات شاشة لمنتج يعمل، روابط، نتائج اختبار، أرقام) لا على الوعود أو الخطط المستقبلية.
- has_working_product = true فقط إذا كان هناك دليل واضح على منتج يعمل (mvp أو complete).
- stage_reason: جملتان بالعربية تشرحان سبب التصنيف.
- problem_clarity: جملة واحدة عن وضوح المشكلة والمستفيد.
- ai_usage: جملة واحدة عن مدى توظيف الذكاء الاصطناعي وقيمته الفعلية.
- strengths و gaps: ثلاث نقاط قصيرة لكل منهما.
- questions_for_judges: ثلاثة أسئلة محددة يُنصح المحكّمون بطرحها على الفريق.
- اكتب كل النصوص بالعربية الفصحى المبسطة، بلا مقدمات.`

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(payload))
}

// في النسخة المنشورة: نقبل الطلبات من موقعنا فقط.
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

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return url && key ? { url, key } : null
}

/* نص الشرائح من ملف PPTX (أرشيف ZIP فيه ppt/slides/slideN.xml) */
export function extractPptxText(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  const slideNames = Object.keys(files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]))
  const notesByIndex = {}
  for (const name of Object.keys(files)) {
    const m = name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/)
    if (m) notesByIndex[m[1]] = xmlText(strFromU8(files[name]))
  }
  const parts = []
  slideNames.forEach((name, i) => {
    const idx = name.match(/slide(\d+)/)[1]
    const text = xmlText(strFromU8(files[name]))
    const notes = notesByIndex[idx]
    if (text || notes) parts.push(`--- الشريحة ${i + 1} ---\n${text}${notes ? `\n[ملاحظات المتحدث] ${notes}` : ''}`)
  })
  return parts.join('\n\n').trim()
}

function xmlText(xml) {
  const chunks = []
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g
  let m
  while ((m = re.exec(xml))) chunks.push(decodeEntities(m[1]))
  // فواصل الفقرات
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
}

function cleanList(value, max = 5) {
  return (Array.isArray(value) ? value : []).map(v => String(v || '').trim()).filter(Boolean).slice(0, max)
}

function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== 'object') return null
  const stage = STAGES.includes(raw.stage) ? raw.stage : null
  if (!stage) return null
  return {
    stage,
    stage_reason: String(raw.stage_reason || '').trim().slice(0, 1000),
    has_working_product: Boolean(raw.has_working_product),
    problem_clarity: String(raw.problem_clarity || '').trim().slice(0, 500),
    ai_usage: String(raw.ai_usage || '').trim().slice(0, 500),
    strengths: cleanList(raw.strengths),
    gaps: cleanList(raw.gaps),
    questions_for_judges: cleanList(raw.questions_for_judges),
  }
}

function parseJsonLoose(text) {
  try { return JSON.parse(text) } catch { /* نحاول استخراج أول كائن JSON */ }
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' })
  }
  if (!originAllowed(req)) return json(res, 403, { ok: false, code: 'NOT_ALLOWED' })

  const database = supabaseConfig()
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!database) return json(res, 503, { ok: false, code: 'DB_NOT_CONFIGURED', message: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط على السيرفر' })
  if (!apiKey) return json(res, 503, { ok: false, code: 'AI_NOT_CONFIGURED', message: 'ANTHROPIC_API_KEY غير مضبوط على السيرفر' })

  // ─── الجلسة: يجب أن تكون جلسة Supabase صالحة لمستخدم موجود في jd_admins ───
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token.length > 4096) return json(res, 401, { ok: false, code: 'UNAUTHORIZED' })
  const admin = createClient(database.url, database.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  let user
  try {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return json(res, 401, { ok: false, code: 'UNAUTHORIZED' })
    user = data.user
  } catch {
    return json(res, 503, { ok: false, code: 'DB_UNAVAILABLE' })
  }
  const { data: adminRow, error: adminErr } = await admin.from('jd_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (adminErr) return json(res, 503, { ok: false, code: 'DB_UNAVAILABLE' })
  if (!adminRow) return json(res, 403, { ok: false, code: 'FORBIDDEN', message: 'الحساب ليس في جدول jd_admins' })

  // ─── المدخلات ───
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}) }
  catch { return json(res, 400, { ok: false, code: 'INVALID_REQUEST' }) }
  const projectId = typeof body?.project_id === 'string' ? body.project_id.trim() : ''
  if (!UUID.test(projectId)) return json(res, 400, { ok: false, code: 'INVALID_REQUEST', message: 'project_id غير صالح' })

  const { data: project, error: projectErr } = await admin.from('jd_projects').select('id,event_id,team_name,title,description,deck_path').eq('id', projectId).maybeSingle()
  if (projectErr) {
    const notMigrated = /deck_path|column/i.test(projectErr.message || '')
    return json(res, 503, { ok: false, code: notMigrated ? 'DB_NOT_MIGRATED' : 'DB_UNAVAILABLE', message: notMigrated ? 'شغّل ملف supabase/judging-setup.sql أولًا (أعمدة التحليل غير موجودة)' : projectErr.message })
  }
  if (!project) return json(res, 404, { ok: false, code: 'PROJECT_NOT_FOUND' })
  if (!project.deck_path) return json(res, 400, { ok: false, code: 'NO_DECK', message: 'ارفع ملف العرض (PDF أو PPTX) أولًا' })
  if (!project.deck_path.startsWith(`${project.event_id}/${project.id}/`)) return json(res, 400, { ok: false, code: 'INVALID_DECK_PATH' })

  // ─── الملف ───
  let buffer
  try {
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(project.deck_path)
    if (dlErr || !blob) return json(res, 404, { ok: false, code: 'DECK_NOT_FOUND', message: 'الملف غير موجود في التخزين' })
    buffer = Buffer.from(await blob.arrayBuffer())
  } catch {
    return json(res, 503, { ok: false, code: 'STORAGE_UNAVAILABLE' })
  }
  if (buffer.length > MAX_BYTES) return json(res, 413, { ok: false, code: 'DECK_TOO_LARGE', message: 'الحد الأقصى 20MB' })
  const ext = project.deck_path.toLowerCase().split('.').pop()
  if (ext !== 'pdf' && ext !== 'pptx') return json(res, 400, { ok: false, code: 'UNSUPPORTED_TYPE', message: 'PDF أو PPTX فقط' })

  const meta = `اسم الفريق: ${project.team_name}\nعنوان المشروع: ${project.title}\n${project.description ? `وصف المنظّم: ${project.description}\n` : ''}`
  const content = []
  if (ext === 'pdf') {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }, title: `${project.team_name} — ${project.title}` })
    content.push({ type: 'text', text: `${meta}\nحلّل عرض المشروع المرفق وأعد النتيجة بالصيغة المطلوبة.` })
  } else {
    let text = ''
    try { text = extractPptxText(buffer) } catch { return json(res, 422, { ok: false, code: 'DECK_UNREADABLE', message: 'تعذّر قراءة ملف PPTX' }) }
    if (!text) return json(res, 422, { ok: false, code: 'DECK_EMPTY', message: 'لم أجد نصًا في الشرائح — جرّب تصدير العرض إلى PDF' })
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS) + '\n[اقتُطع باقي النص]'
    content.push({ type: 'text', text: `${meta}\nنص شرائح العرض:\n\n${text}\n\nحلّل المشروع وأعد النتيجة بالصيغة المطلوبة.` })
  }

  // ─── Claude ───
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 55_000 })
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim()
  let message
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })
    message = await stream.finalMessage()
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(res, 503, { ok: false, code: 'AI_NOT_CONFIGURED', message: 'مفتاح Anthropic غير صالح' })
    if (error instanceof Anthropic.RateLimitError) return json(res, 429, { ok: false, code: 'AI_RATE_LIMITED', message: 'ضغط على خدمة التحليل — حاول بعد قليل' })
    if (error instanceof Anthropic.BadRequestError) return json(res, 502, { ok: false, code: 'AI_BAD_REQUEST', message: error.message })
    if (error instanceof Anthropic.APIError) return json(res, 502, { ok: false, code: 'AI_ERROR', message: `خطأ ${error.status} من خدمة التحليل` })
    return json(res, error?.name === 'TimeoutError' || /timeout/i.test(error?.message || '') ? 504 : 502, { ok: false, code: 'AI_FAILED' })
  }
  if (message.stop_reason === 'refusal') return json(res, 422, { ok: false, code: 'AI_REFUSED', message: 'رفض النموذج تحليل هذا الملف' })
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const analysis = normalizeAnalysis(parseJsonLoose(text))
  if (!analysis) return json(res, 502, { ok: false, code: 'AI_INVALID_OUTPUT', message: 'استجابة غير مفهومة من النموذج' })

  // ─── الحفظ ───
  const analyzed_at = new Date().toISOString()
  const { error: upErr } = await admin.from('jd_projects').update({ ai_analysis: { ...analysis, model, analyzed_at }, ai_stage: analysis.stage, analyzed_at }).eq('id', project.id)
  if (upErr) {
    const notMigrated = /ai_analysis|ai_stage|analyzed_at|column/i.test(upErr.message || '')
    return json(res, 503, { ok: false, code: notMigrated ? 'DB_NOT_MIGRATED' : 'DB_UNAVAILABLE', message: notMigrated ? 'شغّل ملف supabase/judging-setup.sql أولًا (أعمدة التحليل غير موجودة)' : upErr.message })
  }
  return json(res, 200, { ok: true, analysis: { ...analysis, model, analyzed_at }, usage: { input_tokens: message.usage?.input_tokens, output_tokens: message.usage?.output_tokens } })
}
