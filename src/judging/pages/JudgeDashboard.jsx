import { useNavigate } from 'react-router-dom'
import { useJudge } from './JudgeArea'
import { Badge, EmptyState, Icon, Progress } from '../components/ui'
import { STATUS_META, projectMeta } from '../lib'

/* شاشة واحدة: أسماء المشاريع كبطاقات + حالة كل مشروع. لا شيء آخر. */
export default function JudgeDashboard() {
  const { session, event, criteria, projects, scores, statuses, doneCount, slug, reload } = useJudge()
  const navigate = useNavigate()
  const closed = !event.judging_open
  /* التحكيم مغلق ولم يحفظ المحكّم أي درجة ولم تُنشر النتائج = لم يبدأ بعد (لا = انتهى) */
  const notStartedYet = closed && scores.length === 0 && !event.results_published

  if (notStartedYet) {
    return (
      <section className="jd-section">
        <div className="jd-thanks jd-thanks-wait jd-rise">
          <span className="jd-state-icon"><Icon name="clock" size={30} /></span>
          <h2>التحكيم لم يبدأ بعد</h2>
          <p>مرحبًا {session.judge?.name}، دخولك مسجّل لفعالية «{event.name}». ستظهر المشاريع هنا تلقائيًا عندما يفتح المنظّمون باب التقييم، ولا تحتاج إلى تحديث الصفحة.</p>
          <p className="jd-small jd-dim">{projects.length} مشاريع بانتظار التقييم.</p>
          <button type="button" className="jd-btn jd-btn-soft" onClick={() => reload(true)}><Icon name="refresh" size={16} />تحقّق الآن</button>
        </div>
      </section>
    )
  }

  if (closed) {
    return (
      <section className="jd-section">
        <div className="jd-thanks jd-rise">
          <span className="jd-state-icon"><Icon name="check" size={30} /></span>
          <h2>انتهى التحكيم، شكرًا لك</h2>
          <p>{session.judge?.name}، أُغلق باب التقييم لفعالية «{event.name}». تقييماتك محفوظة ولا يمكن تعديلها الآن.</p>
          <p className="jd-small jd-dim">أكملت {doneCount} من {projects.length} مشاريع.</p>
        </div>
      </section>
    )
  }

  const allDone = projects.length > 0 && doneCount === projects.length
  return (
    <section style={{ paddingBottom: 48 }}>
      <div className="jd-judge-head jd-rise">
        <div>
          <p className="jd-kicker" style={{ fontSize: 11 }}>JUDGE PANEL</p>
          <h1>مرحبًا، {session.judge?.name}</h1>
          <div className="meta">{event.name}</div>
        </div>
        <div style={{ minWidth: 'min(100%, 260px)' }}>
          <Progress done={doneCount} total={projects.length} label="المشاريع المكتملة" showPercent={false} />
        </div>
      </div>

      {allDone && (
        <div className="jd-alert jd-alert-ok jd-rise-2" style={{ marginBottom: 12 }}><Icon name="check" size={16} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />أكملت تقييم جميع المشاريع. يمكنك فتح أي مشروع لمراجعة نجومك ما دام التحكيم مفتوحًا.</div>
      )}
      {criteria.length === 0 && <div className="jd-alert jd-alert-warn" style={{ marginBottom: 12 }}>لم تُضَف معايير التقييم بعد — تواصل مع المنظّمين.</div>}

      {projects.length === 0 ? (
        <EmptyState icon="layers" title="لا توجد مشاريع بعد" text="سيضيف المنظّمون المشاريع قبل بدء التحكيم، وستظهر هنا تلقائيًا." />
      ) : (
        <div className="jd-plist">
          {projects.map((p, i) => {
            const st = statuses[p.id]
            const meta = STATUS_META[st]
            const scored = scores.filter(s => s.project_id === p.id).length
            return (
              <button key={p.id} type="button" className={`jd-pcard jd-pcard-min is-${st}`} onClick={() => navigate(`/judge/${slug}/judge/${p.id}`)} style={{ animation: `jdRise .6s cubic-bezier(.22,.7,.2,1) ${Math.min(i, 8) * 0.05}s both` }}>
                <span className="jd-pnum">{st === 'complete' ? <Icon name="check" size={20} /> : String(i + 1).padStart(2, '0')}</span>
                <span className="jd-pcard-body">
                  <b>{p.team_name}</b>
                  <span>{projectMeta(p) || p.title}</span>
                </span>
                <span className="jd-pcard-side">
                  <Badge cls={meta.cls}>{meta.label}{st === 'partial' && <span className="jd-mini-count">{scored}/{criteria.length}</span>}</Badge>
                  <span className="jd-pcard-go">{st === 'complete' ? 'مراجعة' : 'تقييم'}<Icon name="arrowLeft" size={15} /></span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
