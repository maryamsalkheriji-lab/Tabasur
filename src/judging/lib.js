/* ─── ثوابت ومساعدات منصة التحكيم ───
 * خمسة معايير متساوية (وزن 20 لكل معيار في قاعدة البيانات)، كل معيار من 1 إلى 5 نجوم.
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
    name: 'وضوح المشكلة وفهم أسبابها', weight: 20,
    description: 'هل حدّد الفريق المشكلة بدقة، ومن يتأثر بها ومتى، وبأي أدلة، وهل عالج أسبابها لا أعراضها فقط؟',
    questions: ['ما المشكلة التي يعالجها الفريق تحديدًا؟', 'من يتأثر بها؟ وفي أي ظروف تظهر؟', 'ما الأدلة التي تدعم وجود المشكلة وأهميتها؟', 'هل عالج الفريق أسباب المشكلة، أم اكتفى بوصف أعراضها؟'],
    levels: { 1: 'المشكلة غير محددة، أو ادعاءات عامة دون سند.', 2: 'مشكلة عامة بأدلة ضعيفة، والتركيز على الأعراض لا الأسباب.', 3: 'مشكلة محددة بأدلة أولية، مع فهم جزئي للأسباب.', 4: 'مشكلة واضحة ومن يتأثر بها، بأدلة مناسبة وفهم جيد للأسباب.', 5: 'مشكلة محددة بدقة بأدلة واضحة، وتحليل للأسباب الجذرية مع بيان حدود المعرفة.' },
  },
  {
    name: 'فهم المستفيد والتحقق من احتياجه', weight: 15,
    description: 'هل حدّد الفريق المستفيد بدقة، وتحقق من احتياجه ميدانيًا، وعكس ما تعلّمه في قراراته؟',
    questions: ['من المستفيد المستهدف تحديدًا؟', 'كيف يتعامل مع المشكلة حاليًا؟', 'ما المقابلات أو الملاحظات الميدانية التي أجراها الفريق؟', 'ماذا تعلّم الفريق من المستفيدين؟ وكيف انعكس ذلك على قراراته؟'],
    levels: { 1: 'المستفيد غير محدد، أو افتراضات بلا أي تحقق.', 2: 'مستفيد عام مع تحقق محدود جدًا لم يؤثر في الحل.', 3: 'مستفيد محدد مع مقابلات أو ملاحظات أولية.', 4: 'فهم جيد للمستفيد وسلوكه الحالي، وتحقق ميداني انعكس على القرارات.', 5: 'فهم عميق للمستفيد بأدلة ميدانية واضحة، وقرارات تصميم موثّقة بناءً عليها.' },
  },
  {
    name: 'ملاءمة الفكرة وقيمتها المضافة', weight: 15,
    description: 'هل تعالج الفكرة المشكلة المحددة، وما التحسين الملموس مقارنة بالبدائل، وما الذي يدعم احتمال استخدام المستفيد لها؟',
    questions: ['كيف تعالج الفكرة المشكلة المحددة؟', 'ما البدائل المتاحة حاليًا؟', 'ما التحسين الملموس الذي يقدمه الحل مقارنة بالبدائل؟', 'ما الذي يدعم احتمال استخدام المستفيد للحل؟'],
    levels: { 1: 'الفكرة لا ترتبط بالمشكلة، أو بلا قيمة واضحة.', 2: 'ارتباط جزئي بالمشكلة، والبدائل غير مدروسة.', 3: 'الفكرة تعالج المشكلة بقيمة مضافة مقبولة مقارنة بالبدائل.', 4: 'حل ملائم بتحسين ملموس على البدائل، ومؤشرات على رغبة المستفيد في استخدامه.', 5: 'حل ملائم تمامًا بقيمة مضافة واضحة ومُثبتة مقارنة بالبدائل، وأدلة على نية الاستخدام.' },
  },
  {
    name: 'جودة الحد الأدنى من المنتج القابل للتطبيق «MVP»', weight: 20,
    description: 'هل يتيح الـMVP تجربة الوظيفة الأساسية بما يكفي لاختبار الافتراض، مع وضوح ما يعمل فعليًا وما يُنفَّذ يدويًا وما لم يُنفَّذ بعد؟',
    note: 'تُقيَّم جودة الـMVP بملاءمته للتجربة، لا بكثرة الخصائص أو جمال الواجهة. ولا يُشترط أن يكون تطبيقًا؛ قد يكون خدمة تُنفَّذ يدويًا إذا كانت تختبر الافتراض المقصود.',
    questions: ['هل يتيح الـMVP تجربة الوظيفة الأساسية للحل؟', 'هل يستطيع المستفيد إكمال الاستخدام الأساسي المقصود منه؟', 'هل مستوى التنفيذ كافٍ لاختبار الافتراض المستهدف؟', 'هل توجد عيوب تعيق التجربة أو تجعل نتائجها غير موثوقة؟', 'هل يوضح الفريق ما يعمل فعليًا، وما يُنفَّذ يدويًا، وما لم يُنفَّذ بعد؟'],
    levels: { 1: 'لا يوجد ما يمكن تجربته (وصف أو شرائح فقط).', 2: 'أجزاء بسيطة تعمل، ولا يمكن إكمال الاستخدام الأساسي.', 3: 'الوظيفة الأساسية قابلة للتجربة مع عيوب مؤثرة.', 4: 'الـMVP يتيح إكمال الاستخدام الأساسي ويكفي لاختبار الافتراض، مع وضوح ما يعمل وما لا يعمل.', 5: 'MVP مناسب تمامًا للاختبار ومستقر في وظيفته الأساسية، مع تمييز دقيق بين الفعلي واليدوي وغير المنفَّذ.' },
  },
  {
    name: 'الاختبار والتعلّم وقياس النتائج', weight: 15,
    description: 'ما الافتراض الذي اختبره الفريق، وكيف ومع من، وما مؤشر النجاح المحدد مسبقًا، وما النتائج الفعلية والقرار المبني عليها؟',
    note: 'هنا تُقيَّم الأدلة والتعلّم، أما المعيار السابق فيقيّم جودة الـMVP نفسه. لا يُعاقب الفريق لأن تجربته كشفت ضعف الفكرة؛ يُقيَّم على جودة الاختبار وفهم النتيجة واستجابته لها.',
    questions: ['ما الافتراض الذي اختبره الفريق؟', 'كيف أُجري الاختبار؟ ومع من؟', 'ما مؤشر النجاح الذي حُدد قبل التجربة؟', 'ما النتائج الفعلية؟ وما حدودها؟', 'ما القرار الذي اتخذه الفريق بناءً عليها: الاستمرار، أم التعديل، أم إعادة الاختبار؟'],
    levels: { 1: 'لم يُجرَ أي اختبار، أو ادعاءات نتائج بلا سند.', 2: 'اختبار غير منظم بلا مؤشر نجاح محدد مسبقًا.', 3: 'اختبار محدود مع مؤشر نجاح ونتائج أولية.', 4: 'اختبار واضح مع مستفيدين حقيقيين، ونتائج محددة وقرار مبني عليها.', 5: 'اختبار منهجي بمؤشر معلن مسبقًا، ونتائج دقيقة مع بيان حدودها، وقرار واضح: استمرار أو تعديل أو إعادة اختبار.' },
  },
  {
    name: 'إمكانية التنفيذ والاستدامة', weight: 10,
    description: 'ما الموارد والعوائق اللازمة لتشغيل الحل، ومن يستخدمه ويشغّله ويدفع تكلفته، وكيف يستمر ماليًا بعد المعسكر؟',
    questions: ['ما الموارد والمتطلبات اللازمة لتشغيل الحل؟', 'ما أبرز عائق تقني أو تشغيلي أو تنظيمي؟', 'من يستخدم الحل؟ ومن يتولى تشغيله؟ ومن يدفع تكلفته؟', 'كيف يستمر الحل ماليًا بعد المعسكر؟', 'ما التقديرات التي تستند إلى معلومات، وما الذي لا يزال افتراضًا؟'],
    levels: { 1: 'لا تصور للتنفيذ أو الاستدامة.', 2: 'تصور عام بلا تحديد للموارد أو العوائق أو من يدفع التكلفة.', 3: 'خطة أولية للتشغيل، وتقديراتها في معظمها افتراضات.', 4: 'خطة واقعية للموارد والتشغيل والتمويل، مع تمييز بين المعلوم والمفترض.', 5: 'خطة تنفيذ واستدامة متكاملة بتقديرات مستندة إلى معلومات، وعوائق محددة مع طرق معالجتها.' },
  },
  {
    name: 'وضوح الفيديو والعرض النهائي', weight: 5,
    description: 'هل يوضح العرض المشكلة والمستفيد والقيمة وطريقة عمل الـMVP، ويميّز بين المنجز والمخطط، ويعرض نتائج الاختبار بدقة ضمن المدة؟',
    note: 'تُمنح الدرجة لوضوح التواصل ودقة المحتوى، وليس لتكلفة التصوير أو المؤثرات البصرية.',
    questions: ['هل يوضح العرض المشكلة والمستفيد والقيمة المقدمة؟', 'هل يُظهر طريقة عمل الـMVP بوضوح؟', 'هل يميّز بين ما أُنجز فعليًا وما يُخطط له؟', 'هل يعرض نتائج الاختبار بدقة ويلتزم بالمدة المحددة؟'],
    levels: { 1: 'عرض غير مفهوم، أو لا يغطي العناصر الأساسية.', 2: 'عرض يغطي بعض العناصر مع خلط بين المنجز والمخطط.', 3: 'عرض واضح في معظمه، مع نقص في إظهار الـMVP أو النتائج.', 4: 'عرض واضح يُظهر الـMVP والنتائج ويميّز المنجز عن المخطط، ضمن المدة.', 5: 'عرض دقيق ومقنع يغطي كل العناصر بوضوح تام والتزام كامل بالمدة.' },
  },
].map((c, i) => ({ ...c, sort_order: i + 1 }))
export const STANDARD_CRITERIA = CAMP_CRITERIA

/* الدليل الإرشادي لمعيار (بالاسم): أسئلة + وصف المستويات، وإلا الوصف العام */
export function criterionGuide(criterion) {
  const name = String(criterion?.name || '').trim()
  const known = CAMP_CRITERIA.find(c => c.name === name || c.name.replace(/[«»]/g, '').replace(/\s+/g, ' ') === name.replace(/[«»()]/g, '').replace(/\s+/g, ' '))
  return { questions: known?.questions || [], levels: known?.levels || GENERIC_LEVELS, note: known?.note || '' }
}

/* حسم التعادل (وثيقة المعايير): الاختبار والتعلّم، ثم جودة الـMVP — ترتيبٌ للعرض فقط، الدرجات من قاعدة البيانات */
const TIE_BREAK = ['الاختبار والتعلّم وقياس النتائج', 'جودة الحد الأدنى من المنتج القابل للتطبيق «MVP»']
export function rankRows(rows) {
  const key = (r, name) => Number(r.per_criterion?.[name]) || 0
  return (rows || []).slice()
    .sort((a, b) => (Number(b.final_score) - Number(a.final_score)) || (key(b, TIE_BREAK[0]) - key(a, TIE_BREAK[0])) || (key(b, TIE_BREAK[1]) - key(a, TIE_BREAK[1])) || (Number(a.rank) - Number(b.rank)))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

export const REVEAL_STEPS = [
  { step: 0, title: 'الوضع العادي',   hint: 'المنصة والترتيب الكامل (بعد النشر)' },
  { step: 1, title: 'شاشة الانتظار',  hint: 'اسم الفعالية + «النتائج النهائية»' },
  { step: 2, title: 'العدّ التنازلي', hint: '3 ← 2 ← 1' },
  { step: 3, title: 'المركز الثالث',  hint: 'كشف البرونزي' },
  { step: 4, title: 'المركز الثاني',  hint: 'كشف الفضي' },
  { step: 5, title: 'المركز الأول',   hint: 'كشف الذهبي + كونفيتي' },
  { step: 6, title: 'منصة التتويج',   hint: 'المنصة ثم الترتيب الكامل' },
]

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
  if (/column .* does not exist|schema cache/i.test(msg)) return 'قاعدة البيانات غير محدّثة — شغّل ملف supabase/judging-setup.sql في Supabase أولًا.'
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
