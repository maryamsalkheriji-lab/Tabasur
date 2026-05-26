import { Link } from 'react-router-dom'
import AboutSphere from '../components/AboutSphere'
import CTATorus from '../components/CTATorus'
import { useHomeAnimations } from '../lib/animations'
import heroVideoSrc from '/assets/hero-video.mp4'
import styles from './Home.module.css'

/* ─── Hero ─── */
function Hero() {
  return (
    <section className={styles.hero} id="top">

      {/* ✏️ الفيديو — ملفك في public/assets/hero-video.mp4 */}
      <video
        className={styles.heroVideo}
        autoPlay muted loop playsInline preload="auto"
        src={heroVideoSrc}
      />

      <div className={styles.heroContent}>
        <div className="container">
          <span className={`${styles.heroBadge} reveal`}>
            <span className={styles.dot} />
            المدينة المنورة · ربيع ١٤٤٧ هـ
          </span>
          <p className={`${styles.heroSuper} reveal`}>معسكر المحتوى الإبداعي</p>
          <h1 className={`${styles.heroTitle} reveal`}>
            <span className={styles.accent}>تبصُّر</span>
          </h1>
          <p className={`${styles.heroSub} reveal`}>
            حيث تلتقي العدسة بالتاريخ، والذكاءُ بالمكان.
          </p>
          <p className={`${styles.heroDesc} reveal`}>
            معسكر إبداعي يجمع المصوّرين والمصمّمين وصُنّاع الذكاء الاصطناعي، لتوثيق المعالم الخفيّة في المدينة المنورة بعينٍ جديدة.
          </p>
          <div className={`${styles.heroCtas} reveal`}>
            <Link className="btn btn-primary" to="/register">
              سجّل في المعسكر <span className="arrow">→</span>
            </Link>
            <a className="btn btn-ghost" href="#about">اكتشف الفكرة</a>
          </div>
        </div>
      </div>

      <div className={styles.scrollInd} aria-hidden="true">
        <div className={styles.mouse} />
        <span>اسحب للأسفل</span>
      </div>

    </section>
  )
}

/* ─── About ─── */
function About() {
  return (
    <section className={`section about ${styles.about}`} id="about">
      <div className="container">
        <div className={styles.aboutGrid}>
          <div className={`${styles.sphereWrap} reveal-l`}>
            <AboutSphere />
            <span className={styles.sphereCoord}>24.4709°N / 39.6111°E</span>
          </div>
          <div className={`${styles.aboutCopy} reveal-r`}>
            <span className="eyebrow">الفكرة</span>
            <h2>المدينة أكبر من الحرم</h2>
            <p className="lead">خلف الميدان الكبير، تمتدّ المدينة المنورة بحاراتها ومقابرها وآبارها وميادينها التي شهدت آلاف القصص. تبصُّر يدعوك لتوثيق ما يُغفله العابرون.</p>
            <p className="lead">أربعة أيام بين الجوامع التاريخية، والميادين القديمة، والوديان المحيطة؛ نمشي ونصوّر ونصمّم ونُولّد، ونخرج بأرشيف بصري جديد للمدينة.</p>
            <div className={styles.aboutStats}>
              <div className={styles.stat}><strong style={{color:'var(--green-700)'}}>٤</strong><span>أيام</span></div>
              <div className={styles.stat}><strong style={{color:'var(--mauve-600)'}}>٢٠+</strong><span>موقع تاريخي</span></div>
              <div className={styles.stat}><strong style={{color:'var(--coral-600)'}}>٣٠</strong><span>مقعدًا فقط</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Pillars ─── */
function Pillars() {
  const pillars = [
    {
      num: 'PILLAR / ٠١', title: 'التصوير',
      accent: 'var(--green-600)', soft: 'var(--green-100)',
      desc: 'قراءة الضوء على الحجر، وتأطير الحياة اليومية في الأحياء القديمة. ورش ميدانية مع مصوّرين محترفين، وتحرير ليلي جماعي.',
      tags: ['Street','Documentary','Architecture','Editing'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>,
    },
    {
      num: 'PILLAR / ٠٢', title: 'التصميم',
      accent: 'var(--mauve-600)', soft: 'var(--mauve-100)',
      desc: 'من الحرف المدنية إلى الهويات المعاصرة. نبني نظمًا بصرية مستلهمة من خطّ الحجاز والزخرفة الإسلامية، بأدوات معاصرة.',
      tags: ['Identity','Type','Editorial','Layout'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/><circle cx="15" cy="14.5" r="2"/></svg>,
    },
    {
      num: 'PILLAR / ٠٣', title: 'الذكاء الاصطناعي',
      accent: 'var(--coral-500)', soft: 'var(--coral-100)',
      desc: 'من البرومبت إلى الإخراج النهائي. نوظّف نماذج الصورة والفيديو والصوت لإعادة تخيّل المدينة، مع نقاش حول الأخلاق والمسؤولية.',
      tags: ['Image','Video','Audio','Ethics'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/></svg>,
    },
  ]

  return (
    <section className={`section pillars ${styles.pillars}`} id="pillars">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">المحاور الثلاثة</span>
          <h2>ثلاث عدسات، مدينة واحدة</h2>
          <p className="lead">نقترب من المكان من ثلاث زوايا تتقاطع وتتكامل؛ يخرج كلّ مشارك بأدوات وأرشيف ومشروع نهائي ينتمي لأكثر من تخصّص.</p>
          <div className="divider" />
        </div>
        <div className={`pillars-grid ${styles.pillarsGrid}`}>
          {pillars.map((p, i) => (
            <article key={i} className={`pillar ${styles.pillar}`}
              style={{'--accent': p.accent, '--accent-soft': p.soft}}>
              <div>
                <span className={styles.num}>{p.num}</span>
                <div className={styles.pillarIcon}>{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
              <div className={styles.pillarTags}>
                {p.tags.map(t => <span key={t}>{t}</span>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Who ─── */
function Who() {
  const cards = [
    { n:'/ ٠١ — PHOTOGRAPHER', title:'مصوّر', desc:'ضوء طبيعي، أحياء قديمة، وجوه عابرة. حقيبتك على كتفك، وعدستك جاهزة للحظات لا تتكرّر.', accent:'var(--green-500)' },
    { n:'/ ٠٢ — CREATOR', title:'صانع محتوى', desc:'تروي القصص بصرامةٍ سينمائية، وتعرف كيف تربط بين المشهد والمتلقّي على المنصّات.', accent:'var(--mauve-500)' },
    { n:'/ ٠٣ — DESIGNER', title:'مصمّم', desc:'تترجم الحجر والخطّ والظلّ إلى نظام بصري، من الهوية إلى الإصدارة المطبوعة.', accent:'var(--coral-500)' },
    { n:'/ ٠٤ — AI ARTIST', title:'متخصّص AI', desc:'تعرف الـ Workflow من البرومبت إلى الـ Render، وتسعى لتوظيف النماذج في خدمة المكان لا استبداله.', accent:'var(--gold-500)' },
  ]
  return (
    <section className="section" id="who">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">لمن هذا المعسكر</span>
          <h2>إن كنتَ واحدًا من هؤلاء</h2>
          <p className="lead">نبحث عن أصواتٍ بصريّة متفرّدة، لا عن سيَر ذاتية. اختر التخصّص الأقرب لك وأرسل أعمالك، نختار ثلاثين منكم.</p>
          <div className="divider" />
        </div>
        <div className={`who-grid ${styles.whoGrid}`}>
          {cards.map((c, i) => (
            <div key={i} className={`who-card reveal ${styles.whoCard}`} style={{'--accent': c.accent}}>
              <span className={styles.whoGlyph}>{c.n}</span>
              <div><h4>{c.title}</h4><p>{c.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Timeline ─── */
function Timeline() {
  const days = [
    { side:'right', time:'اليوم الأول — وصول', day:'DAY · ٠١', title:'الاستقبال والتعارف',
      items:['افتتاح في خانة قديمة وسط المدينة','محاضرة "كيف نرى المدينة" — أ. ضيف الشرف','توزيع الفرق وتسليم العتاد والشارات'] },
    { side:'left', time:'اليوم الثاني — ميدان', day:'DAY · ٠٢', title:'ميدان وورش',
      items:['جولة فجريّة في قُبا، العوالي، البقيع','ورشة الإضاءة الطبيعية والصورة الوثائقية','ورشة الـ Prompt Engineering للمكان'] },
    { side:'right', time:'اليوم الثالث — إنتاج', day:'DAY · ٠٣', title:'الاستوديو والتجميع',
      items:['جلسات Critique جماعية ومراجعة فردية','ورشة التصميم والتنضيد والكتاب البصري','ليلة سينما تحت سماء وادي العقيق'] },
    { side:'left', time:'اليوم الرابع — معرض', day:'DAY · ٠٤', title:'المعرض الختامي',
      items:['تنصيب المعرض وتجريب العرض المباشر','افتتاح مفتوح للجمهور وحوار مع المشاركين','تسليم النسخ المطبوعة وشهادات تبصُّر'] },
  ]
  return (
    <section className={`section timeline ${styles.timeline}`} id="timeline">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">المسار · أربعة أيام</span>
          <h2>من الفكرة إلى المعرض</h2>
          <p className="lead">جدول مكثّف يجمع بين الميدان والاستوديو والحوار، وينتهي بمعرض مفتوح وكتاب بصري مطبوع.</p>
          <div className="divider" />
        </div>
        <div className={`timeline-wrap ${styles.timelineWrap}`}>
          <div className={`timeline-line ${styles.timelineLine}`} id="tlLine" />
          {days.map((d, i) => (
            <div key={i} className={`tl-row ${d.side} ${styles.tlRow} ${d.side === 'right' ? `${styles.right} reveal-r` : `${styles.left} reveal-l`}`}>
              {d.side === 'right' && <div className={`tl-time ${styles.tlTime}`}>{d.time}</div>}
              <div className={`tl-dot ${styles.tlDot}`} />
              <div className={`tl-card ${styles.tlCard}`}>
                <span className={`day ${styles.day}`}>{d.day}</span>
                <h4>{d.title}</h4>
                <ul>{d.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
              </div>
              {d.side === 'left' && <div className={`tl-time ${styles.tlTime}`}>{d.time}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Partners ─── */
function Partners() {
  return (
    <section className={`section partners ${styles.partners}`} id="partners">
      <div className="pattern-stars" aria-hidden="true" />
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">بدعم وشراكة</span>
          <h2>شركاء صنعوا رحلة تبصُّر</h2>
          <p className="lead">تبصُّر مبادرة وطنية بتعاون استراتيجي يجمع بين أهل المدينة والمشاريع الكبرى التي تؤمن بقوّة الصورة. شركاؤنا يفتحون الأبواب، ويُتيحون التجربة بكل امتيازاتها.</p>
          <div className="divider" />
        </div>
        <div className={`partners-grid ${styles.partnersGrid}`}>
          <article className={`partner-card reveal-r ${styles.partnerCard}`} style={{'--accent':'var(--mauve-600)','--accent-soft':'var(--mauve-100)','--accent-soft-2':'var(--green-50)'}}>
            <span className="partner-tag">الشريك الرسمي</span>
            <div className="partner-mark" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.5" opacity=".35"/>
                <path d="M14 50 L14 38 L20 38 L20 32 Q24 22 28 32 L28 38 L36 38 L36 28 Q40 18 44 28 L44 38 L50 38 L50 50 Z" fill="currentColor"/>
                <circle cx="40" cy="22" r="3" fill="currentColor" opacity=".5"/>
                <circle cx="40" cy="22" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h3>أمانة المدينة المنوّرة</h3>
              <span className="partner-en">MADINAH MUNICIPALITY</span>
            </div>
            <p>الجهة الرسمية الراعية للمعسكر؛ تفتح أبواب المعالم التاريخية، وتُتيح الوصول إلى الأحياء والميادين القديمة بمرافقة باحثين وأمناء تراث.</p>
            <div className="partner-foot">
              <strong>الشريك الراعي · رسمي</strong>
              <span>ESTABLISHED · ١٣٥٧ هـ</span>
            </div>
          </article>

          <article className={`partner-card reveal-l ${styles.partnerCard}`} style={{'--accent':'var(--green-700)','--accent-soft':'var(--green-100)','--accent-soft-2':'var(--mauve-100)'}}>
            <span className="partner-tag">الشريك الاستراتيجي</span>
            <div className="partner-mark" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                <path d="M32 8 L54 20 L54 44 L32 56 L10 44 L10 20 Z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <path d="M32 8 L32 32 M32 32 L54 20 M32 32 L10 20" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M32 8 L54 20 L32 32 Z" fill="currentColor" opacity=".18"/>
                <path d="M32 8 L10 20 L32 32 Z" fill="currentColor" opacity=".10"/>
              </svg>
            </div>
            <div>
              <h3>مُكعّب</h3>
              <span className="partner-en">THE MUKAAB</span>
            </div>
            <p>المشروع الإبداعي الرائد الذي يدعم تبصُّر بالكوادر والتقنيات والاستوديوهات، ويُلهم المشاركين رؤية المدن بأبعاد جديدة.</p>
            <div className="partner-foot">
              <strong>الشريك الاستراتيجي</strong>
              <span>NEW MURABBA · KSA</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section className={`section cta ${styles.cta}`} id="cta">
      <CTATorus />
      <div className="container" style={{position:'relative',zIndex:3,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'26px'}}>
        <span className="eyebrow reveal" style={{color:'var(--green-400)'}}>انضم لـ ٣٠ مبدعًا فقط</span>
        <h2 className="reveal" style={{fontSize:'clamp(48px,7vw,108px)',fontWeight:900,lineHeight:1,letterSpacing:'-0.02em',color:'#fff'}}>
          مكانك بين المبدعين
        </h2>
        <p className="reveal" style={{fontSize:'clamp(16px,1.6vw,20px)',color:'rgba(255,255,255,0.78)',maxWidth:'620px'}}>
          التسجيل مفتوح حتى ١٥ شعبان ١٤٤٧ هـ. مقاعد محدودة، والاختيار يتمّ بناءً على أعمالك السابقة.
        </p>
        <Link to="/register" className="btn btn-primary reveal"
          style={{fontSize:'17px',padding:'20px 36px',background:'var(--green-500)',color:'var(--ink-900)',fontWeight:700}}>
          سجّل الآن <span className="arrow">→</span>
        </Link>
        <span className="reveal" style={{fontSize:'12px',color:'rgba(255,255,255,0.55)',letterSpacing:'0.1em',marginTop:'6px'}}>
          بدون رسوم · إقامة وإعاشة مشمولة · شهادة معتمدة
        </span>
      </div>
    </section>
  )
}

/* ─── Home Page ─── */
export default function Home() {
  // تشغيل كل الـ GSAP animations بعد mount
  useHomeAnimations()

  return (
    <>
      <Hero />
      <div className="proportion-strip" aria-hidden="true">
        <span className="g" /><span className="c" /><span className="m" />
      </div>
      <About />
      <Pillars />
      <Who />
      <Timeline />
      <Partners />
      <CTA />
    </>
  )
}
