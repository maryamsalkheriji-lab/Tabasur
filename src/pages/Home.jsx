import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import CTATorus from '../components/CTATorus'
import { useHomeAnimations } from '../lib/animations'
import styles from './Home.module.css'

const heroVideoSrc = '/assets/hero-video.mp4'

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
            <span className={styles.accent}>تَبصِّر</span>
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
            <a className={`btn ${styles.heroGhost}`} href="#about">اكتشف الفكرة</a>
          </div>
          <div className={`${styles.heroFacts} reveal`}>
            <span>المدينة المنورة · السعودية</span>
            <i />
            <span>٤ أيام مكثفة</span>
            <i />
            <span>+٤٠ موهبة مستهدفة</span>
            <i />
            <span>مخرجات قابلة للنشر</span>
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

/* ─── About — بانر صورة كامل العرض ─── */
function About() {
  const stats = [
    { value: '٤', label: 'أيام مكثفة', tone: 'teal' },
    { value: '+٤٠', label: 'مشارك مستهدف', tone: 'green' },
    { value: '٨٠٪', label: 'تطبيق عملي', tone: 'teal' },
    { value: '٤', label: 'مسارات تحدٍّ', tone: 'green' },
  ]

  return (
    <section className={`section about ${styles.about}`} id="about">
      <div className={`${styles.aboutBanner} reveal`}>
        {/* ✏️ صورة البانر — public/assets/about-madinah.png */}
        <img
          className={styles.aboutImg}
          src="/assets/about-madinah.png"
          alt="ساحة عامة في المدينة المنورة"
        />
        <div className={styles.aboutVeil} aria-hidden="true" />
        <div className={styles.aboutContent}>
          <div className={styles.aboutBody}>
            <span className={styles.aboutTag}>عن المعسكر</span>
            <h2>من عرض الأماكن إلى رواية تجربة مدينة</h2>
            <p>
              تَبصِّر لا يكتفي بالترويج للمدينة، بل يعيد اكتشافها وفهم تحوّلها وسرد قصتها بصريًا كما عاشها الناس — بمحتوى قابل للنشر يبرز التطور الحضري والإنساني.
            </p>
            <span className={styles.aboutCoord}>24.4709°N / 39.6111°E</span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className={`${styles.aboutStats} reveal`}>
          {stats.map((s) => (
            <div className={styles.stat} key={s.label}>
              <strong data-tone={s.tone}>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pillars — كاروسيل أفقي ─── */
function Pillars() {
  const pillars = [
    {
      num: 'TRACK / 01',
      title: 'الوجهة وتجربة الزائر',
      img: '/assets/track-01.png',
      alt: 'زوار يستكشفون سوق التمور في المدينة المنورة',
      desc: 'تقديم المدينة كوجهة غنية بالتجارب الدينية والثقافية والسياحية، وتشجيع الزائر على اكتشاف مساراتها ووجهاتها المحلية.',
    },
    {
      num: 'TRACK / 02',
      title: 'جودة الحياة',
      img: '/assets/track-02.png',
      alt: 'مساحات عامة وتنقل ذكي في المدينة',
      desc: 'رواية تطور المساحات العامة والخدمات والتنقل والحلول الذكية، وإظهار أثرها في تجربة الإنسان اليومية داخل المدينة.',
    },
    {
      num: 'TRACK / 03',
      title: 'الاستثمار والفرص',
      img: '/assets/track-03.png',
      alt: 'لقاء أعمال في ساحة تجارية',
      desc: 'إظهار المدينة كبيئة واعدة للقطاع الخاص ورواد الأعمال، وإبراز فرص السياحة والضيافة والمساحات العامة والشراكات.',
    },
    {
      num: 'TRACK / 04',
      title: 'الهوية والسردية',
      img: '/assets/track-04.png',
      alt: 'جلسة تراثية ورواية قصص المدينة',
      desc: 'ربط التطوير الحديث بروح المدينة وذاكرتها البصرية، وسرد قصص سكانها وزوارها بما يحفظ أصالتها ويجدد صورتها.',
    },
  ]

  const scroller = useRef(null)
  const dragging = useRef(false)

  const step = useCallback(() => {
    const el = scroller.current
    if (!el) return 320
    const card = el.firstElementChild
    const gap = parseFloat(getComputedStyle(el).columnGap || '20') || 20
    return (card ? card.offsetWidth : 300) + gap
  }, [])

  const nudge = useCallback((dir) => {
    const el = scroller.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollBy({ left: (rtl ? -1 : 1) * dir * step(), behavior: 'smooth' })
  }, [step])

  /* السحب بالماوس */
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let active = false
    let startX = 0
    let startLeft = 0

    const down = (e) => {
      active = true
      dragging.current = false
      startX = e.clientX
      startLeft = el.scrollLeft
      el.style.cursor = 'grabbing'
      el.style.scrollSnapType = 'none'
    }
    const move = (e) => {
      if (!active) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) dragging.current = true
      el.scrollLeft = startLeft - dx
    }
    const up = () => {
      if (!active) return
      active = false
      el.style.cursor = 'grab'
      el.style.scrollSnapType = 'x mandatory'
      setTimeout(() => { dragging.current = false }, 60)
    }
    const noDrag = (e) => e.preventDefault()

    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('dragstart', noDrag)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('dragstart', noDrag)
    }
  }, [])

  return (
    <section className={`section pillars ${styles.pillars}`} id="pillars">
      <div className={styles.pillarsLayout}>

        <div className={`${styles.pillarsHead} reveal`}>
          <span className="eyebrow">المسارات</span>
          <h2>مسارات التحدّي في تَبصِّر</h2>
          <p className="lead">
            أربع زوايا تروي تحوّل المدينة. يختار كل فريق مسارًا يبني عليه عمله الإنتاجي، بما يضمن تغطية متكاملة للقصة الحضرية والإنسانية.
          </p>
          <div className={styles.pillarsNav}>
            <button type="button" onClick={() => nudge(-1)} aria-label="السابق">→</button>
            <button type="button" onClick={() => nudge(1)} aria-label="التالي">←</button>
          </div>
        </div>

        <div className={`pillars-grid ${styles.pillarsTrack}`} ref={scroller}>
          {pillars.map((p) => (
            <article className={`pillar ${styles.pillar}`} key={p.num}>
              <div className={styles.pillarImg}>
                <img src={p.img} alt={p.alt} draggable="false" />
              </div>
              <span className={styles.num}>{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
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
    { n:'/ 02 — AI', title:'متخصّص AI', desc:'تستخدم الذكاء الاصطناعي لتوليد الأفكار، كتابة السيناريو، وتحسين الإنتاج.', accent:'var(--teal-600)' },
    { n:'/ 03 — MARKETING', title:'مسوّق مدن', desc:'تفهم بناء الصورة الذهنية وتعرف كيف تُترجم تجربة المدينة إلى رسالة واضحة.', accent:'var(--coral-500)' },
    { n:'/ 04 — DESIGN', title:'مصمّم', desc:'تبني هوية بصرية ورسائل تصميمية تعكس روح المدينة وتحولها.', accent:'var(--mauve-500)' },
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
          <p className="lead">لا تُبنى الشراكة في تَبصِّر على الظهور الإعلامي فقط، بل على صناعة الأثر، دعم التحوّل الحضري، وتمكين المواهب.</p>
          <div className="divider" />
        </div>
        <div className={`partners-grid ${styles.partnersGrid}`}>
          <article className={`partner-card reveal-r ${styles.partnerCard}`} style={{'--accent':'var(--green-500)'}}>
            <div className={styles.partnerTop}>
              <span className={styles.partnerMark} aria-hidden="true">
                <img src={partnerLogo} alt="" />
              </span>
              <span className={styles.partnerTag}>الشريك الرسمي</span>
            </div>
            <div>
              <h3>أمانة المدينة المنوّرة</h3>
              <span className={styles.partnerEn}>MADINAH MUNICIPALITY</span>
            </div>
            <p>شريك في إبراز التحوّل الحضري وجودة الحياة، وربط المشاركين بتجربة المدينة اليومية وخدماتها ومساحاتها العامة.</p>
            <div className={styles.partnerFoot}>
              <strong>حضور مؤسسي</strong>
              <span>CITY STORY</span>
            </div>
          </article>

          <article className={`partner-card reveal-l ${styles.partnerCard}`} style={{'--accent':'var(--mauve-500)'}}>
            <div className={styles.partnerTop}>
              <span className={`${styles.partnerMark} ${styles.cubexMark}`} aria-hidden="true">
                <img className={styles.cubexLogo} src={cubexLogo} alt="" />
              </span>
              <span className={`${styles.partnerTag} ${styles.partnerTagAlt}`}>الشريك الاستراتيجي</span>
            </div>
            <div>
              <h3>كيوبكس</h3>
              <span className={styles.partnerEn}>CUBEX</span>
            </div>
            <p>شريك تقني وإبداعي يدعم تحويل الأفكار إلى محتوى قابل للنشر، ويعزز حضور الابتكار داخل تجربة المعسكر.</p>
            <div className={styles.partnerFoot}>
              <strong>ابتكار وإنتاج</strong>
              <span>AI · CONTENT</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ─── Sponsors — شريط يدور تلقائيًا ─── */
function Sponsors() {
  /* ✏️ أضف الرعاة هنا: name = اسم الجهة، logo = مسار الشعار في public/assets
     اترك logo فارغًا (null) ليظهر مكان الشعار كعنصر بديل. */
  const sponsors = [
    { name: 'أمانة المدينة المنورة', logo: '/assets/amana-logo.png' },
    { name: 'كيوبكس', logo: '/assets/cubex-logo.png' },
    { name: 'شعار الجهة', logo: null },
    { name: 'شعار الجهة', logo: null },
    { name: 'شعار الجهة', logo: null },
    { name: 'شعار الجهة', logo: null },
  ]
  /* دورة عريضة تكفي الشاشات الكبيرة، ثم تُنسخ كاملة لحركة بلا أي فراغ. */
  const marqueeSponsors = [...sponsors, ...sponsors]

  return (
    <section className={`section sponsors ${styles.sponsors}`} id="sponsors">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">الرعاة</span>
          <h2>دعم يصنع أثرًا لا ظهورًا فقط</h2>
          <p className="lead">في تَبصِّر، الرعاة شركاء في تمكين المواهب وبناء الصورة الذهنية الحديثة للمدينة من خلال محتوى حقيقي قابل للانتشار.</p>
          <div className="divider" />
        </div>
      </div>

      <div className={styles.sponsorsMarquee}>
        <div className={styles.sponsorsTrack}>
          {[0, 1].map((copy) => (
            <div className={styles.sponsorsGroup} key={copy} aria-hidden={copy === 1}>
              {marqueeSponsors.map((sponsor, i) => (
                <article className={styles.sponsorCard} key={`${sponsor.name}-${i}`}>
                  <div className={`${styles.sponsorMark} ${sponsor.dark ? styles.sponsorMarkDark : ''}`}>
                    {sponsor.logo
                      ? <img src={sponsor.logo} alt={copy === 0 ? sponsor.name : ''} draggable="false" />
                      : <span className={styles.sponsorPlaceholder}>شعار الجهة</span>}
                  </div>
                  <h3 className={styles.sponsorName}>{sponsor.name}</h3>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="container">
        <div className={`${styles.sponsorsCta} reveal`}>
          <div>
            <h3>تسجيل الرعاة</h3>
            <p>هذا النموذج مخصص للجهات الراغبة في رعاية معسكر تَبصِّر والمشاركة في رواية قصة التحوّل ودعم المواهب.</p>
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
      <div className="container" style={{position:'relative',zIndex:3,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'22px'}}>
        <span className="eyebrow reveal" style={{alignSelf:'center'}}>انضم إلى أكثر من 40 موهبة</span>
        <h2 className="reveal" style={{fontSize:'clamp(40px,6.4vw,92px)',fontWeight:900,lineHeight:1.02,letterSpacing:'-0.035em',color:'var(--ink-900)'}}>
          مكانك بين المبدعين
        </h2>
        <p className="reveal" style={{fontSize:'clamp(15px,1.5vw,18px)',color:'var(--ink-500)',maxWidth:'56ch',lineHeight:1.9}}>
          مقاعد محدودة ضمن فرق إنتاجية متخصصة، والاختيار يتم بناءً على جودة أعمالك السابقة وتنوع خبرتك.
        </p>
        <Link to="/register" className="btn btn-primary reveal" style={{fontSize:'17px',padding:'19px 38px'}}>
          سجّل الآن <span className="arrow">→</span>
        </Link>
        <span className="reveal" style={{fontSize:'12px',color:'var(--ink-400)',letterSpacing:'0.1em',marginTop:'4px'}}>
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
