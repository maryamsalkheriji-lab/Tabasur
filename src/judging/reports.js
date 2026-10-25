import { csvCell } from '../lib/security.js'
import { rankRows, STAGES } from './lib.js'

// Fetch every page: Supabase caps each response, including large score exports.
export async function fetchAllRows(query) {
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query().range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function loadTeamReport(supabase, event) {
  const [results, projects, criteria] = await Promise.all([
    fetchAllRows(() => supabase.rpc('jd_results', { p_slug: event.slug }).order('project_id')),
    fetchAllRows(() => supabase.from('jd_projects').select('id,team_name,title,stage,eligible,sort_order').eq('event_id', event.id).order('sort_order').order('id')),
    fetchAllRows(() => supabase.from('jd_criteria').select('id,name,weight,sort_order').eq('event_id', event.id).order('sort_order').order('id')),
  ])
  const byId = new Map(rankRows(results).map(r => [r.project_id, r]))
  const rows = projects.map(p => ({
    ...p, project_id: p.id, rank: null, final_score: null, judges_count: 0, per_criterion: {}, ...byId.get(p.id),
  })).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.sort_order - b.sort_order))
  return { rows, criteria }
}

export function teamReportCSV(rows, criteria) {
  const number = value => value == null || !Number.isFinite(Number(value)) ? '' : Number(Number(value).toFixed(2))
  const header = ['الترتيب', 'الفريق', 'المشروع', 'المرحلة', 'مؤهل', 'عدد المحكّمين',
    ...criteria.map(c => `${c.name} (من ${c.weight})`), 'الدرجة النهائية (من 100)', 'حالة التقييم']
  return [header, ...rows.map(r => [r.rank, r.team_name, r.title, STAGES[r.stage]?.label || r.stage,
    r.eligible === false ? 'لا' : 'نعم', r.judges_count,
    ...criteria.map(c => number(r.per_criterion?.[c.name])), number(r.final_score),
    r.final_score == null ? (r.eligible === false ? 'غير مؤهل' : 'لا يوجد تقييم مكتمل') : 'تقييم مكتمل',
  ])].map(row => row.map(csvCell).join(','))
}
