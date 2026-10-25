/* ─── ثوابت ومساعدات منصة التحكيم ───
 * سبعة معايير بأوزان مجموعها 100، كل معيار من 1 إلى 5.
 * الدرجة النهائية تُحسب في قاعدة البيانات (jd_results) ولا تُعرض الأوزان للمحكّمين إطلاقًا. */

export const SITE_ORIGIN = 'https://cubex.com.sa'

export const STAGES = {
  idea:      { label: 'فكرة',        badge: 'jd-badge-gray' },
  prototype: { label: 'نموذج أولي',  badge: 'jd-badge-blue' },
  mvp:       { label: 'MVP',         badge: 'jd-badge-amber' },
  complete:  { label: 'مكتمل',       badge: 'jd-badge-green' },
}
export const STAGE_OPTIONS = Object.entries(STAGES).map(([value, s]) => ({ value, label: s.label }))
export const TRACKS = ['الرياضة', 'السياحة', 'الزراعة']
/* السطر الذي يظهر تحت اسم المشروع للمحكّم: المسار وعدد الفريق */
export function projectMeta(p) {
  const parts = []
  if (p?.track) parts.push(`المسار: ${p.track}`)
  if (p?.team_size) parts.push(`${p.team_size} أعضاء`)
  return parts.join(' · ')
}
export function isValidSlugReserved(slug) { return slug === 'admin' }


export const SCORE_VALUES = [1, 2, 3, 4, 5]
/* مقياس الدرجات (وفق وثيقة معايير المعسكر): المستوى 0 «لم يُقدَّم شيء» مدموج في المستوى 1 لأن قاعدة البيانات تقبل 1–5 */
export const SCORE_LABELS = { 1: 'غير مستوفى', 2: 'استيفاء جزئي', 3: 'استيفاء مقبول', 4: 'استيفاء قوي', 5: 'استيفاء متكامل' }
export const GENERIC_LEVELS = {
  1: 'لم يُقدَّم ما يجيب عن المعيار، أو ادعاءات عامة دون سند.',
  2: 'استيفاء جزئي مع فجوات جوهرية.',
  3: 'استيفاء مقبول تدعمه أدلة أولية.',
  4: 'استيفاء قوي تدعمه أدلة مناسبة، مع فجوات محدودة.',
  5: 'استيفاء متكامل للمرحلة المطلوبة، تدعمه أدلة واضحة مع بيان حدودها.',
}

/* معايير تحكيم المعسكر — 100 درجة (وثيقة الإدارة) مع أسئلة إرشادية ووصف لكل مستوى.
 * الأوزان في قاعدة البيانات فقط ولا تُعرض للمحكّم. درجة المعيار = الدرجة ÷ 5 × الوزن، والنهائية متوسط المحكّمين (تُحسب في قاعدة البيانات). */
export const CAMP_CRITERIA = [
  {
    name: 'اكتمال المنتج وعمله فعليًا', weight: 30,
    description: 'هل يعمل المنتج فعليًا ويتيح إكمال الاستخدام الأساسي من البداية إلى النهاية دون عوائق جوهرية؟',
    questions: ['هل يمكن تجربة المنتج الآن؟', 'هل تكتمل رحلة الاستخدام الأساسية؟', 'ما الوظائف المنفذة فعليًا وما الذي لم يُنفذ بعد؟'],
    levels: { 1: 'لا يوجد منتج قابل للتجربة.', 2: 'أجزاء محدودة تعمل ولا تكتمل رحلة الاستخدام.', 3: 'تعمل الوظائف الأساسية مع عوائق مؤثرة.', 4: 'تكتمل رحلة الاستخدام مع نواقص محدودة.', 5: 'منتج مكتمل في نطاقه المعلن ويعمل باستقرار في تجربة فعلية.' },
  },
  {
    name: 'معالجة المشكلة وملاءمة الحل', weight: 15,
    description: 'هل يعالج المنتج مشكلة واضحة للمستفيد المستهدف ويقدم حلًا ملائمًا مدعومًا بأدلة؟',
    questions: ['ما المشكلة ومن المستفيد؟', 'كيف يعالجها المنتج؟', 'ما القيمة مقارنة بالبدائل الحالية؟'],
    levels: { 1: 'المشكلة غير محددة أو الحل غير مرتبط بها.', 2: 'ارتباط جزئي بالمشكلة دون فهم كافٍ للمستفيد.', 3: 'حل ملائم لمشكلة محددة بأدلة أولية.', 4: 'حل واضح القيمة يستجيب لاحتياج موثق.', 5: 'حل يعالج المشكلة بدقة مع أدلة قوية على ملاءمته وقيمته للمستفيد.' },
  },
  {
    name: 'جودة التنفيذ التقني', weight: 15,
    description: 'هل التنفيذ التقني منظم وموثوق، وتتكامل مكوناته مع معالجة الأخطاء وحماية البيانات؟',
    questions: ['هل تعمل المكونات والتكاملات معًا؟', 'كيف يتعامل المنتج مع الأخطاء؟', 'هل راعى الفريق أمن البيانات وجودة الأداء؟'],
    levels: { 1: 'لا يوجد تنفيذ تقني يمكن التحقق منه.', 2: 'تنفيذ هش مع أخطاء جوهرية أو مكونات غير مترابطة.', 3: 'تنفيذ مقبول يعمل في الظروف الأساسية.', 4: 'تنفيذ منظم وموثوق مع معالجة مناسبة للأخطاء والبيانات.', 5: 'تنفيذ متقن ومستقر ومدعوم بأدلة على الجودة والأداء وحماية البيانات.' },
  },
  {
    name: 'الاختبار وإثبات فاعلية المنتج', weight: 15,
    description: 'هل اختُبر المنتج مع مستخدمين أو حالات واقعية وأظهرت النتائج فاعليته بمؤشرات واضحة؟',
    questions: ['كيف اختُبر المنتج ومع من؟', 'ما مؤشرات النجاح والنتائج الفعلية؟', 'ما حدود الاختبار والتحسينات الناتجة عنه؟'],
    levels: { 1: 'لا توجد اختبارات أو أدلة على الفاعلية.', 2: 'تجارب محدودة دون مؤشرات واضحة.', 3: 'اختبارات أولية بنتائج قابلة للمراجعة.', 4: 'اختبارات واقعية بنتائج واضحة وتحسينات مبنية عليها.', 5: 'اختبارات منهجية تثبت الفاعلية بمؤشرات واضحة مع بيان حدود النتائج.' },
  },
  {
    name: 'توظيف تقنيات الذكاء الاصطناعي', weight: 10,
    description: 'هل يوظف المنتج الذكاء الاصطناعي فعليًا في وظيفة مفيدة وملائمة، مع التحقق من جودة المخرجات وحدودها؟',
    questions: ['أين يعمل الذكاء الاصطناعي داخل المنتج؟', 'ما القيمة التي يضيفها؟', 'كيف تُراجع جودة المخرجات وتُعالج الأخطاء؟'],
    levels: { 1: 'لا يوجد توظيف فعلي للذكاء الاصطناعي.', 2: 'توظيف شكلي أو غير مترابط مع حاجة المنتج.', 3: 'توظيف فعلي ومفيد مع تحقق محدود من الجودة.', 4: 'توظيف ملائم ومتكامل مع مراجعة للمخرجات وحدودها.', 5: 'توظيف فعّال يضيف قيمة مثبتة مع قياس الجودة ومعالجة المخاطر والأخطاء.' },
  },
  {
    name: 'الجدوى وقابلية التطوير', weight: 10,
    description: 'هل توجد خطة واقعية لتشغيل المنتج واستدامته وتطويره بناءً على الموارد والتكلفة واحتياج السوق؟',
    questions: ['ما تكلفة وموارد تشغيل المنتج؟', 'كيف يستمر ويصل إلى المستفيدين؟', 'ما خطة التطوير والتوسع والعوائق المتوقعة؟'],
    levels: { 1: 'لا تصور للجدوى أو التطوير.', 2: 'تصور عام دون تقدير الموارد والتكاليف.', 3: 'خطة أولية مع افتراضات تحتاج تحققًا.', 4: 'خطة واقعية للتشغيل والاستدامة والتطوير.', 5: 'جدوى مدعومة بأدلة وخطة واضحة للتطوير والتوسع ومعالجة العوائق.' },
  },
  {
    name: 'العرض النهائي والتجربة المباشرة', weight: 5,
    description: 'هل يشرح العرض المنتج وقيمته بوضوح ويعرض تجربة مباشرة ودقيقة لما يعمل فعليًا؟',
    questions: ['هل يوضح العرض المشكلة والحل والنتائج؟', 'هل يعرض الفريق تجربة مباشرة للمنتج؟', 'هل يميز المنجز عن المخطط ويلتزم بالمدة؟'],
    levels: { 1: 'عرض غير واضح دون تجربة للمنتج.', 2: 'عرض جزئي وتجربة غير مكتملة.', 3: 'عرض مفهوم وتجربة أساسية مع نقص في الوضوح.', 4: 'عرض واضح وتجربة مباشرة تغطي الوظائف الأساسية ضمن المدة.', 5: 'عرض دقيق ومقنع وتجربة مباشرة متكاملة توضح قيمة المنتج ونتائجه وحدوده.' },
  },
].map((c, i) => ({ ...c, sort_order: i + 1 }))
export const STANDARD_CRITERIA = CAMP_CRITERIA

/* الدليل الإرشادي لمعيار (بالاسم): أسئلة + وصف المستويات، وإلا الوصف العام */
export function criterionGuide(criterion) {
  const name = String(criterion?.name || '').trim()
  const known = CAMP_CRITERIA.find(c => c.name === name || c.name.replace(/[«»]/g, '').replace(/\s+/g, ' ') === name.replace(/[«»()]/g, '').replace(/\s+/g, ' '))
  return { questions: known?.questions || [], levels: known?.levels || GENERIC_LEVELS, note: known?.note || '' }
}

/* حسم التعادل (وثيقة المعايير): الاختبار وإثبات الفاعلية، ثم اكتمال المنتج — ترتيبٌ للعرض فقط، الدرجات من قاعدة البيانات */
const TIE_BREAK = ['الاختبار وإثبات فاعلية المنتج', 'اكتمال المنتج وعمله فعليًا']
export function rankRows(rows) {
  const key = (r, name) => Number(r.per_criterion?.[name]) || 0
  return (rows || []).slice()
    .sort((a, b) => (Number(b.final_score) - Number(a.final_score)) || (key(b, TIE_BREAK[0]) - key(a, TIE_BREAK[0])) || (key(b, TIE_BREAK[1]) - key(a, TIE_BREAK[1])) || (Number(a.rank) - Number(b.rank)))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/* خطوات الريموت (reveal_step في قاعدة البيانات) — اختيارية: الخطوة 0 تترك التحكم لصفحة النتائج نفسها (الضغط على البطاقة) */
export const REVEAL_STEPS = [
  { step: 0, title: 'التحكم من الشاشة', hint: 'الكشف بالضغط على البطاقة في صفحة النتائج' },
  { step: 1, title: 'المركز الثالث',    hint: 'بطاقة مغلقة — تُفتح بالضغط' },
  { step: 2, title: 'المركز الثاني',    hint: 'الثالث مكشوف، والثاني مغلق' },
  { step: 3, title: 'المركز الأول',     hint: 'الثاني والثالث مكشوفان، والأول مغلق' },
  { step: 4, title: 'منصة التتويج',     hint: 'الثلاثة معًا ثم الترتيب الكامل' },
]
export const MAX_REVEAL_STEP = REVEAL_STEPS.length - 1

export const RANK_META = {
  1: { label: 'المركز الأول',  cls: 'gold',   medal: 'medal-gold',   rank: 'rank-gold' },
  2: { label: 'المركز الثاني', cls: 'silver', medal: 'medal-silver', rank: 'rank-silver' },
  3: { label: 'المركز الثالث', cls: 'bronze', medal: 'medal-bronze', rank: 'rank-bronze' },
}

export function eventStatus(ev) {
  if (!ev) return { label: 'قريبًا', cls: 'jd-badge-gray' }
  if (ev.results_published) return { label: 'النتائج معلنة', cls: 'jd-badge-green' }
  if (ev.judging_open) return { label: 'التحكيم جارٍ الآن', cls: 'jd-badge-purple jd-badge-live', live: true }
  return { label: 'التحكيم لم يبدأ', cls: 'jd-badge-gray' }
}

/* رمز الدخول: حروف كبيرة وأرقام فقط، شرطة بعد 4 خانات */
export function formatAccessCode(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}
export function isValidAccessCode(code) {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function normalizeSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
export function isValidSlug(slug) {
  return SLUG_RE.test(slug) && slug.length <= 60 && slug !== 'admin'
}

export function judgeLoginLink(slug) { return `${SITE_ORIGIN}/judge/${slug}` }
export function inviteLink(slug, code) { return `${SITE_ORIGIN}/judge/${slug}?code=${encodeURIComponent(code)}` }
export function resultsLink(slug) { return `${SITE_ORIGIN}/judge/${slug}/results` }

/* ملفات العروض */
export const DECK_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}
export const MAX_DECK_BYTES = 20 * 1024 * 1024
export function deckName(path) { return String(path || '').split('/').pop()?.replace(/^\d+-/, '') || '' }

/* رسائل أخطاء عربية لأخطاء Supabase / الدوال */
export function jdError(err, fallback = 'حدث خطأ غير متوقع') {
  const code = err?.code || ''
  const msg = String(err?.message || err || '')
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'العملية مرفوضة من قاعدة البيانات (لا تملك صلاحية لهذا الإجراء، أو التحكيم مغلق).'
  if (code === '23505' || /duplicate key/i.test(msg)) return 'القيمة مكررة — يوجد سجل بنفس المعرّف (مثل slug مستخدم من قبل).'
  if (code === '23514' || /check constraint/i.test(msg)) return 'القيمة غير مقبولة — تحقق من الحدود (الدرجة من 1 إلى 5).'
  if (code === '23503' || /foreign key/i.test(msg)) return 'لا يمكن إتمام العملية لوجود سجلات مرتبطة بها.'
  if (code === 'PGRST116') return 'السجل غير موجود.'
  if (code === 'PGRST202' || /column .* does not exist|schema cache/i.test(msg)) return 'قاعدة البيانات غير محدّثة — شغّل ملف supabase/judging-update-2026-10-14.sql في Supabase أولًا.'
  if (/Bucket not found/i.test(msg)) return 'مخزن الملفات jd-decks غير موجود — شغّل ملف supabase/judging-setup.sql أولًا.'
  if (/results not published/i.test(msg)) return 'لم تُعلن النتائج بعد.'
  if (/not allowed/i.test(msg)) return 'هذا الإجراء للأدمن فقط — تأكد أن حسابك مضاف في جدول jd_admins.'
  if (/jwt|expired|invalid token/i.test(msg)) return 'انتهت الجلسة — سجّل الدخول مجددًا.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'تعذّر الاتصال بالخادم — تحقق من الشبكة.'
  return msg || fallback
}

export function judgeLoginError(code) {
  switch (code) {
    case 'invalid_code': return 'رمز الدخول غير صحيح، أو انتهت صلاحيته، أو أُلغي. اطلب رمزًا جديدًا من المنظّمين.'
    case 'too_many_attempts': return 'محاولات كثيرة — انتظر 10 دقائق ثم حاول مرة أخرى.'
    case 'invalid_input': return 'صيغة الرمز غير صحيحة — الصيغة المطلوبة XXXX-XXXX.'
    case 'login_failed': return 'تعذّر تسجيل الدخول — حاول مجددًا.'
    case 'server': return 'خطأ في الخادم — حاول بعد قليل.'
    default: return jdError(code, 'تعذّر تسجيل الدخول')
  }
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}
export function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return iso }
}
export function fmtScore(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return (Math.round(v * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
/* قيمة معيار من jd_results (نقاط من وزنه) → متوسط نجوم من 5 */
export function starsFromCriterion(value, weight) {
  const v = Number(value), w = Number(weight)
  if (!Number.isFinite(v)) return null
  if (Number.isFinite(w) && w > 0 && v <= w) return (v / w) * 5
  if (v <= 5) return v
  return null
}

/* حالة تقييم مشروع لمحكّم: none / partial / complete */
export function projectStatus(projectId, criteria, scores) {
  const ids = new Set(criteria.map(c => c.id))
  const mine = scores.filter(s => s.project_id === projectId && ids.has(s.criterion_id))
  if (!mine.length || !ids.size) return 'none'
  return mine.length >= ids.size ? 'complete' : 'partial'
}
export const STATUS_META = {
  none:     { label: 'لم يُقيَّم', cls: 'jd-badge-gray' },
  partial:  { label: 'غير مكتمل', cls: 'jd-badge-amber' },
  complete: { label: 'مكتمل',     cls: 'jd-badge-green' },
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok
    } catch { return false }
  }
}

export function downloadCSV(filename, lines) {
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function storageGet(key, fallback = null) {
  try { const v = sessionStorage.getItem(key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}
export function storageSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* التخزين غير متاح */ }
}
