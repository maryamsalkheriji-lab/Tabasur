import { Link } from 'react-router-dom'
import CTATorus from '../components/CTATorus'
import { useHomeAnimations } from '../lib/animations'
import styles from './Home.module.css'
import AboutGlobe from '../components/AboutGlobe'

const heroVideoSrc = 'https://res.cloudinary.com/dcaxxjahn/video/upload/v1779829618/14842162_3840_2160_30fps_mdfapw.mp4'

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
            النسخة الأولى · 4 أيام مكثفة
          </span>
          <p className={`${styles.heroSuper} reveal`}>معسكر لتسويق المدن</p>
          <h1 className={`${styles.heroTitle} reveal`}>
            <span className={styles.accent}>تَبصِّر</span>
          </h1>
          <p className={`${styles.heroSub} reveal`}>
            نحكي قصة التحوّل كما عاشها الناس.
          </p>
          <p className={`${styles.heroDesc} reveal`}>
            تجربة إنتاجية مكثفة تعيد اكتشاف المدينة المنورة، وتروي قصة تحوّلها بصريًا كما عاشها الناس، بدمج الذكاء الاصطناعي وصناعة المحتوى.
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
            <AboutGlobe />
            <span className={styles.sphereCoord}>24.4709°N / 39.6111°E</span>
          </div>
          <div className={`${styles.aboutCopy} reveal-r`}>
            <span className="eyebrow">عن المعسكر</span>
            <h2>من عرض الأماكن إلى رواية تجربة مدينة</h2>
            <p className="lead">تَبصِّر لا يكتفي بالترويج للمدينة، بل يعيد اكتشافها وفهم تحوّلها وسرد قصتها بصريًا كما عاشها الناس.</p>
            <p className="lead">يركّز المعسكر على إنتاج محتوى قابل للنشر، يبرز التطور الحضري والإنساني، ويقدّم المدينة المنورة بصورة جديدة تواكب واقعها اليوم.</p>
            <div className={styles.aboutStats}>
              <div className={styles.stat}><strong>4</strong><span>أيام مكثفة</span></div>
              <div className={styles.stat}><strong>40+</strong><span>مشارك مستهدف</span></div>
              <div className={styles.stat}><strong>80%</strong><span>تطبيق عملي</span></div>
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
      num: 'TRACK / 01', title: 'الوجهة وتجربة الزائر',
      accent: 'var(--green-600)', soft: 'var(--green-100)',
      desc: 'تقديم المدينة كوجهة غنية بالتجارب الدينية والثقافية والسياحية، وتشجيع الزائر على اكتشاف مساراتها ووجهاتها المحلية.',
      tags: ['Destination','Visitor','Culture','Tourism'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>,
    },
    {
      num: 'TRACK / 02', title: 'جودة الحياة',
      accent: 'var(--gold-500)', soft: 'var(--gold-200)',
      desc: 'رواية تطور المساحات العامة والخدمات والتنقل والحلول الذكية، وإظهار أثرها في تجربة الإنسان اليومية داخل المدينة.',
      tags: ['Quality of Life','Mobility','Public Space','Smart City'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/><circle cx="15" cy="14.5" r="2"/></svg>,
    },
    {
      num: 'TRACK / 03', title: 'الاستثمار والفرص',
      accent: 'var(--coral-500)', soft: 'var(--coral-100)',
      desc: 'إظهار المدينة كبيئة واعدة للقطاع الخاص ورواد الأعمال، وإبراز فرص السياحة والضيافة والمساحات العامة والشراكات.',
      tags: ['Investment','Hospitality','Entrepreneurship','Partnerships'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/></svg>,
    },
    {
      num: 'TRACK / 04', title: 'الهوية والسردية',
      accent: 'var(--mauve-600)', soft: 'var(--mauve-100)',
      desc: 'ربط التطوير الحديث بروح المدينة وذاكرتها البصرية، وسرد قصص سكانها وزوارها بما يحفظ أصالتها ويجدد صورتها.',
      tags: ['Identity','Narrative','Heritage','People'],
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>,
    },
  ]

  return (
    <section className={`section pillars ${styles.pillars}`} id="pillars">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">مسارات التحدّي</span>
          <h2>أربع زوايا تروي تحوّل المدينة</h2>
          <p className="lead">يختار كل فريق مسارًا يبني عليه عمله الإنتاجي، بما يضمن تغطية متكاملة لقصة التحوّل الحضري والإنساني.</p>
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
    { n:'/ 01 — CONTENT', title:'صانع محتوى', desc:'تحوّل القصص والتجارب اليومية إلى محتوى بصري قابل للنشر والانتشار.', accent:'var(--green-500)' },
    { n:'/ 02 — AI', title:'متخصّص AI', desc:'تستخدم الذكاء الاصطناعي لتوليد الأفكار، كتابة السيناريو، وتحسين الإنتاج.', accent:'var(--mauve-500)' },
    { n:'/ 03 — MARKETING', title:'مسوّق مدن', desc:'تفهم بناء الصورة الذهنية وتعرف كيف تُترجم تجربة المدينة إلى رسالة واضحة.', accent:'var(--coral-500)' },
    { n:'/ 04 — DESIGN', title:'مصمّم', desc:'تبني هوية بصرية ورسائل تصميمية تعكس روح المدينة وتحولها.', accent:'var(--gold-500)' },
  ]
  return (
    <section className="section" id="who">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">الفئة المستهدفة</span>
          <h2>لصنّاع المحتوى والتسويق والذكاء الاصطناعي</h2>
          <p className="lead">نبحث عن مواهب قادرة على تحويل المدينة إلى قصة: فيديو، كتابة، تصميم، تسويق، أو أدوات ذكاء اصطناعي توليدي.</p>
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
    { side:'right', time:'اليوم 01 — الفهم', day:'DAY 01', title:'تسويق المدن والسرد الحضري',
      items:['خصوصية المدينة المنورة','فهم التحوّل الحضري والإنساني','تكوين الفرق واختيار المسارات'] },
    { side:'left', time:'اليوم 02 — الاكتشاف', day:'DAY 02', title:'الأفكار والزوايا الجديدة',
      items:['استخدام AI لتوليد الأفكار','تحليل الجمهور والرسائل','تطوير زوايا محتوى قابلة للنشر'] },
    { side:'right', time:'اليوم 03 — الإنتاج', day:'DAY 03', title:'من السيناريو إلى النموذج',
      items:['كتابة السيناريو وبناء القصة','تصوير وتصميم ومونتاج','تحسين المخرجات بالذكاء الاصطناعي'] },
    { side:'left', time:'اليوم 04 — الإطلاق', day:'DAY 04', title:'عرض الأعمال والتكريم',
      items:['إطلاق جماعي للمحتوى','عرض أفضل الأعمال أمام لجنة','تكريم الفائزين وتوثيق المخرجات'] },
  ]
  return (
    <section className={`section timeline ${styles.timeline}`} id="timeline">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">رحلة المشاركين</span>
          <h2>من الفهم إلى الإطلاق</h2>
          <p className="lead">رحلة مكثفة تمزج التعلم بالتطبيق، وتنتهي بمحتوى قابل للنشر يخدم صورة المدينة وتجربة الزائر.</p>
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

/* ─── Outputs ─── */
function Outputs() {
  const outputs = [
    { value: '30–40', label: 'فيلمًا قصيرًا', desc: 'أعمال بصرية قابلة للنشر المباشر تروي قصة المدينة.' },
    { value: '4', label: 'حملات رقمية', desc: 'حملات متكاملة وموجّهة لفئات مستهدفة واضحة.' },
    { value: 'AI', label: 'محتوى معزّز', desc: 'من توليد الفكرة وكتابة السيناريو إلى التحسين والتحليل.' },
    { value: '∞', label: 'مكتبة محتوى', desc: 'أصول ونماذج أعمال يمكن للجهات تطويرها والاستفادة منها.' },
  ]

  return (
    <section className={`section ${styles.outputs}`} id="outputs">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">مخرجات المعسكر</span>
          <h2>مصنع محتوى رقمي للمدينة</h2>
          <p className="lead">تنتهي الرحلة بأعمال حقيقية قابلة للنشر، تجمع بين السرد القصصي البصري والذكاء الاصطناعي والحملات الموجّهة.</p>
          <div className="divider" />
        </div>
        <div className={styles.outputsGrid}>
          {outputs.map((output, index) => (
            <article className={`${styles.outputCard} reveal`} key={output.label}>
              <span className={styles.outputIndex}>0{index + 1}</span>
              <strong>{output.value}</strong>
              <h3>{output.label}</h3>
              <p>{output.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Partners ─── */
function Partners() {
  const partnerLogo = '/assets/amana-logo.png'
  const cubexLogo = '/assets/cubex-logo.png'

  return (
    <section className={`section partners ${styles.partners}`} id="partners">
      <div className="pattern-stars" aria-hidden="true" />
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">الشركاء</span>
          <h2>شركاء في رواية قصة التحوّل</h2>
          <p className="lead">لا تُبنى الشراكة في تَبصِّر على الظهور الإعلامي فقط، بل على صناعة الأثر، دعم التحوّل الحضري، وتمكين المواهب.</p>
          <div className="divider" />
        </div>
        <div className={`partners-grid ${styles.partnersGrid}`}>
          <article className={`partner-card reveal-r ${styles.partnerCard}`} style={{'--accent':'var(--green-700)','--accent-soft':'var(--green-100)','--accent-soft-2':'var(--mauve-100)'}}>
            <span className="partner-tag">الشريك الرسمي</span>
            <div className="partner-mark" aria-hidden="true">
              <img src={partnerLogo} alt="" />
            </div>
            <div>
              <h3>أمانة المدينة المنوّرة</h3>
              <span className="partner-en">MADINAH MUNICIPALITY</span>
            </div>
            <p>شريك في إبراز التحوّل الحضري وجودة الحياة، وربط المشاركين بتجربة المدينة اليومية وخدماتها ومساحاتها العامة.</p>
            <div className="partner-foot">
              <strong>حضور مؤسسي</strong>
              <span>قصة المدينة اليوم</span>
            </div>
          </article>

          <article className={`partner-card reveal-l ${styles.partnerCard}`} style={{'--accent':'var(--mauve-600)','--accent-soft':'var(--mauve-100)','--accent-soft-2':'var(--green-50)'}}>
            <span className="partner-tag">الشريك الاستراتيجي</span>
            <div className={`partner-mark ${styles.cubexMark}`} aria-hidden="true">
              <img className={styles.cubexLogo} src={cubexLogo} alt="" />
            </div>
            <div>
              <h3>كيوبكس</h3>
              <span className="partner-en">CUBEX</span>
            </div>
            <p>شريك تقني وإبداعي يدعم تحويل الأفكار إلى محتوى قابل للنشر، ويعزز حضور الابتكار داخل تجربة المعسكر.</p>
            <div className="partner-foot">
              <strong>ابتكار وإنتاج</strong>
              <span>AI · CONTENT</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ─── Sponsors ─── */
function Sponsors() {
  const placeholderLogo = '/assets/amana-logo.png'
  const sponsors = [
    {
      tier: 'شريك استراتيجي',
      name: 'أمانة المدينة المنورة',
      en: 'MADINAH MUNICIPALITY',
      desc: 'حضور داخل مشروع نوعي يوثّق التحوّل الحضري ويصنع محتوى قابلًا للانتشار.',
      accent: 'var(--green-600)',
      soft: 'var(--green-100)',
      logo: placeholderLogo,
    },
    {
      tier: 'راعي رئيسي',
      name: 'كيوبكس',
      en: 'CUBEX',
      desc: 'دعم الابتكار والإبداع والوصول إلى مجتمع المواهب وصنّاع المحتوى.',
      accent: 'var(--mauve-600)',
      soft: 'var(--mauve-100)',
      logo: placeholderLogo,
    },
    {
      tier: 'راعي ذهبي',
      name: 'راعي ذهبي',
      en: 'GOLD SPONSOR',
      desc: 'تعزيز الصورة المؤسسية والارتباط بقصة التحوّل التي يعيشها الناس.',
      accent: 'var(--coral-600)',
      soft: 'var(--coral-100)',
      logo: placeholderLogo,
    },
    {
      tier: 'راعي داعم',
      name: 'راعي داعم',
      en: 'SUPPORTING SPONSOR',
      desc: 'فرصة لبناء علاقات وشراكات جديدة داخل منظومة المحتوى والابتكار.',
      accent: 'var(--gold-500)',
      soft: 'var(--gold-200)',
      logo: placeholderLogo,
    },
  ]

  return (
    <section className={`section sponsors ${styles.sponsors}`} id="sponsors">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">الرعاة</span>
          <h2>دعم يصنع أثرًا لا ظهورًا فقط</h2>
          <p className="lead">في تَبصِّر، الرعاة شركاء في تمكين المواهب وبناء الصورة الذهنية الحديثة للمدينة من خلال محتوى حقيقي قابل للانتشار.</p>
          <div className="divider" />
        </div>
        <div className={`sponsors-grid ${styles.sponsorsGrid}`}>
          {sponsors.map((sponsor) => (
            <article
              key={sponsor.name}
              className={`sponsor-card reveal ${styles.sponsorCard}`}
              style={{ '--s-accent': sponsor.accent, '--s-soft': sponsor.soft }}
            >
              <span className={styles.sponsorTier}>{sponsor.tier}</span>
              <div className={styles.sponsorMark} aria-hidden="true">
                <img src={sponsor.logo} alt="" />
              </div>
              <div>
                <h3 className={styles.sponsorName}>{sponsor.name}</h3>
                <div className={styles.sponsorEn}>{sponsor.en}</div>
              </div>
              <p className={styles.sponsorDesc}>{sponsor.desc}</p>
            </article>
          ))}
        </div>
        <div className={`${styles.sponsorsCta} reveal`}>
          <div>
            <h3>تسجيل الرعاة</h3>
            <p>هذا النموذج مخصص للجهات الراغبة في رعاية معسكر تَبصِّر والمشاركة في رواية قصة التحوّل ودعم المواهب.</p>
          </div>
          <Link className={`btn btn-primary ${styles.sponsorsCtaBtn}`} to="/sponsor-register">
            سجّل كراعٍ <span className="arrow">→</span>
          </Link>
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
        <span className="eyebrow reveal" style={{color:'var(--mauve-600)'}}>انضم إلى أكثر من 40 موهبة</span>
        <h2 className="reveal" style={{fontSize:'clamp(48px,7vw,108px)',fontWeight:900,lineHeight:1,letterSpacing:'-0.02em',color:'var(--ink-900)'}}>
          مكانك بين المبدعين
        </h2>
        <p className="reveal" style={{fontSize:'clamp(16px,1.6vw,20px)',color:'var(--ink-700)',maxWidth:'620px'}}>
          مقاعد محدودة ضمن فرق إنتاجية متخصصة، والاختيار يتم بناءً على جودة أعمالك السابقة وتنوع خبرتك.
        </p>
        <Link to="/register" className="btn btn-primary reveal"
          style={{fontSize:'17px',padding:'20px 36px',background:'var(--paper)',color:'var(--mauve-700)',border:'1px solid var(--mauve-300)',fontWeight:800}}>
          سجّل الآن <span className="arrow">→</span>
        </Link>
        <span className="reveal" style={{fontSize:'12px',color:'var(--ink-500)',letterSpacing:'0.1em',marginTop:'6px'}}>
          تجربة إنتاجية مكثفة · شهادة مشاركة · مخرجات قابلة للنشر
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
      <Outputs />
      <Partners />
      <Sponsors />
      <CTA />
    </>
  )
}
