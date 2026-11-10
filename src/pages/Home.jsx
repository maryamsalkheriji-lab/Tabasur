import { Fragment, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import CTATorus from '../components/CTATorus'
import { useHomeAnimations } from '../lib/animations'
import { registrationStatus, sponsors } from '../lib/camp'
import { useLanguage } from '../lib/language'
import styles from './Home.module.css'

const heroVideoSrc = '/assets/hero-video.mp4'

/* ─── Hero ─── */
function Hero() {
  const { t, lang } = useLanguage()
  const h = t.home.hero
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
          <h1 className={`${styles.heroTitle} reveal`}>
            <span className={styles.accent}>{h.title}</span>
          </h1>
          <p className={`${styles.heroSub} reveal`}>
            {h.sub}
          </p>
          <p className={`${styles.heroDesc} reveal`}>
            {h.desc}
          </p>
          <div className={`${styles.heroCtas} reveal`}>
            <Link className="btn btn-primary" to="/register">
              {h.register} <span className="arrow">→</span>
            </Link>
            <a className={`btn ${styles.heroGhost}`} href="#about">{h.about}</a>
            <Link className={`btn ${styles.heroGhost}`} to="/tabsur/remote">{h.remote} <span className="arrow">{h.remoteArrow}</span></Link>
            <Link className={`btn ${styles.heroGhost}`} to="/tabsur/submit">{h.submit} <span className="arrow">{h.remoteArrow}</span></Link>
          </div>
          <div className={`${styles.heroFacts} reveal`}>
            <span>{registrationStatus[lang]}</span>
            {h.facts.map(fact => <Fragment key={fact}><i /><span>{fact}</span></Fragment>)}
          </div>
        </div>
      </div>

      <div className={styles.scrollInd} aria-hidden="true">
        <div className={styles.mouse} />
        <span>{h.scroll}</span>
      </div>

    </section>
  )
}

/* ─── About — بانر صورة كامل العرض ─── */
function About() {
  const { t } = useLanguage()
  const a = t.home.about
  const stats = [
    { value: '4', label: a.stats[0], tone: 'teal' },
    { value: '100', label: a.stats[1], tone: 'green' },
    { value: '80%', label: a.stats[2], tone: 'teal' },
    { value: '4', label: a.stats[3], tone: 'green' },
  ]

  return (
    <section className={`section about ${styles.about}`} id="about">
      <div className={`${styles.aboutBanner} reveal`}>
        {/* ✏️ صورة البانر — public/assets/about-madinah.png */}
        <img
          className={styles.aboutImg}
          src="/assets/about-madinah.png"
          alt={a.alt}
        />
        <div className={styles.aboutVeil} aria-hidden="true" />
        <div className={styles.aboutContent}>
          <div className={styles.aboutBody}>
            <span className={styles.aboutTag}>{a.tag}</span>
            <h2>{a.title}</h2>
            <p>
              {a.text}
            </p>
          </div>
        </div>
      </div>

      <div className="container">
        <div className={`${styles.aboutStats} reveal`}>
          {stats.map((s) => (
            <div className={styles.stat} key={s.label}>
              <strong data-tone={s.tone}><bdi dir="ltr">{s.value}</bdi></strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pillars — كاروسيل أفقي ─── */
const pillarImages = ['/assets/track-01.png', '/assets/track-02.png', '/assets/track-03.png', '/assets/track-04.png']

function Pillars() {
  const { t } = useLanguage()
  const p = t.home.pillars
  const pillars = p.items.map((item, i) => ({ ...item, img: pillarImages[i] }))

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
          <span className="eyebrow">{p.eyebrow}</span>
          <h2>{p.title}</h2>
          <p className="lead">
            {p.lead}
          </p>
          <div className={styles.pillarsNav}>
            <button type="button" onClick={() => nudge(-1)} aria-label={p.prev}>{p.prevGlyph}</button>
            <button type="button" onClick={() => nudge(1)} aria-label={p.next}>{p.nextGlyph}</button>
          </div>
        </div>

        <div className={`pillars-grid ${styles.pillarsTrack}`} ref={scroller}>
          {pillars.map((item) => (
            <article className={`pillar ${styles.pillar}`} key={item.img}>
              <div className={styles.pillarImg}>
                <img src={item.img} alt={item.alt} draggable="false" />
              </div>
              <span className={styles.num}>{item.num}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>

      </div>
    </section>
  )
}

const journeyColors = ['var(--green-500)', 'var(--teal-600)', 'var(--coral-500)', 'var(--mauve-500)']

function AudienceIcon({ index }) {
  const shapes = [
    <g><rect x="4" y="7" width="23" height="22" rx="5" /><path d="m27 14 8-4v16l-8-4M11 7l3-4h7l3 4" /><circle cx="16" cy="18" r="5" /></g>,
    <g><rect x="9" y="9" width="22" height="22" rx="6" /><path d="M15 3v6m10-6v6M15 31v6m10-6v6M3 15h6m-6 10h6m22-10h6m-6 10h6m-17-11-5 6h5l-2 6 7-8h-5l2-4" /></g>,
    <g><path d="m6 17 22-8v22L6 23zM28 16l6-3v14l-6-3M10 25l3 9h6l-3-7M32 6l3-3M34 33l3 3" /></g>,
    <g><path d="m20 4 12 20-12 12L8 24zM20 4v15M8 24h8m8 0h8" /><circle cx="20" cy="23" r="4" /><path d="M7 5H3v4m30-4h4v4M3 31v4h4m26 0h4v-4" /></g>,
  ]
  return <span className={styles.whoIcon} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[index]}</svg></span>
}

/* ─── Who ─── */
const whoMeta = [
  { n: '/ 01 — CONTENT', accent: 'var(--green-500)' },
  { n: '/ 02 — AI', accent: 'var(--teal-600)' },
  { n: '/ 03 — MARKETING', accent: 'var(--coral-500)' },
  { n: '/ 04 — DESIGN', accent: 'var(--mauve-500)' },
]
function Who() {
  const { t } = useLanguage()
  const w = t.home.who
  const cards = w.cards.map((card, i) => ({ ...card, ...whoMeta[i] }))
  return (
    <section className="section" id="who">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{w.eyebrow}</span>
          <h2>{w.title}</h2>
          <p className="lead">{w.lead}</p>
          <div className="divider" />
        </div>
        <div className={`who-grid ${styles.whoGrid}`}>
          {cards.map((c, i) => (
            <div key={i} className={`who-card reveal ${styles.whoCard}`} style={{'--accent': c.accent}}>
              <AudienceIcon index={i} />
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
const daySides = ['right', 'left', 'right', 'left']
function Timeline() {
  const { t } = useLanguage()
  const tl = t.home.timeline
  const wrapRef = useRef(null)
  useEffect(() => {
    const wrap = wrapRef.current
    const line = wrap.querySelector('.timeline-line')
    const update = () => {
      const rows = [...wrap.querySelectorAll('.tl-row')]
      const stops = rows.map((row) => row.offsetTop + row.offsetHeight / 2)
      const segments = journeyColors.map((color, i) => `${color} ${i === 0 ? 0 : stops[i - 1]}px ${i === journeyColors.length - 1 ? wrap.offsetHeight : stops[i]}px`)
      line.style.setProperty('--journey-gradient', `linear-gradient(to bottom, ${segments.join(', ')})`)
    }
    const observer = new ResizeObserver(update)
    observer.observe(wrap)
    update()
    return () => observer.disconnect()
  }, [])
  const days = tl.days.map((day, i) => ({ ...day, side: daySides[i] }))
  return (
    <section className={`section timeline ${styles.timeline}`} id="timeline">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{tl.eyebrow}</span>
          <h2>{tl.title}</h2>
          <p className="lead">{tl.lead}</p>
          <div className="divider" />
        </div>
        <div ref={wrapRef} className={`timeline-wrap ${styles.timelineWrap}`}>
          <div className={`timeline-line ${styles.timelineLine}`} id="tlLine" />
          {days.map((d, i) => (
            <div key={i} style={{ '--day-accent': journeyColors[i] }} className={`tl-row ${d.side} ${styles.tlRow} ${d.side === 'right' ? `${styles.right} reveal-r` : `${styles.left} reveal-l`}`}>
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
  const { t } = useLanguage()
  const o = t.home.outputs

  return (
    <section className={`section ${styles.outputs}`} id="outputs">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{o.eyebrow}</span>
          <h2>{o.title}</h2>
          <p className="lead">{o.lead}</p>
          <div className="divider" />
        </div>
        <div className={styles.outputsGrid}>
          {o.items.map((output, index) => (
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
  const { t } = useLanguage()
  const pa = t.home.partners
  const partnerLogo = '/assets/amana-organizer.png'
  const cubexLogo = '/assets/cubex-share-dark.png'

  return (
    <section className={`section partners ${styles.partners}`} id="partners">
      <div className="pattern-stars" aria-hidden="true" />
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{pa.eyebrow}</span>
          <h2>{pa.title}</h2>
          <p className="lead">{pa.lead}</p>
          <div className="divider" />
        </div>
        <div className={`partners-grid ${styles.partnersGrid}`}>
          <article className={`partner-card reveal-r ${styles.partnerCard}`} style={{'--accent':'var(--green-500)'}}>
            <div className={styles.partnerTop}>
              <span className={styles.partnerMark} aria-hidden="true">
                <img src={partnerLogo} alt="" />
              </span>
              <span className={styles.partnerTag}>{pa.owner.tag}</span>
            </div>
            <div>
              <h3>{pa.owner.name}</h3>
              <span className={styles.partnerEn}>{pa.owner.sub}</span>
            </div>
            <p>{pa.owner.desc}</p>
            <div className={styles.partnerFoot}>
              <strong>{pa.owner.foot}</strong>
              <span>{pa.owner.footCode}</span>
            </div>
          </article>

          <article className={`partner-card reveal-l ${styles.partnerCard}`} style={{'--accent':'var(--mauve-500)'}}>
            <div className={styles.partnerTop}>
              <span className={`${styles.partnerMark} ${styles.cubexMark}`} aria-hidden="true">
                <img className={styles.cubexLogo} src={cubexLogo} alt="" />
              </span>
              <span className={`${styles.partnerTag} ${styles.partnerTagAlt}`}>{pa.executor.tag}</span>
            </div>
            <div>
              <h3>{pa.executor.name}</h3>
              <span className={styles.partnerEn}>{pa.executor.sub}</span>
            </div>
            <p>{pa.executor.desc}</p>
            <div className={styles.partnerFoot}>
              <strong>{pa.executor.foot}</strong>
              <span>{pa.executor.footCode}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ─── Sponsors — شريط يدور تلقائيًا ─── */
/* مساحة ثابتة لكل شعار (نسبة من عرض الإطار) تجعل الطولي والعريض بنفس الثقل البصري. */
const LOGO_BOX_RATIO = 1.8
const LOGO_AREA = 0.42
function logoWidth(ratio) {
  const w = Math.sqrt(LOGO_AREA * ratio / LOGO_BOX_RATIO)
  return `${Math.min(w, 1, ratio / LOGO_BOX_RATIO) * 100}%`
}

function Sponsors() {
  const { t } = useLanguage()
  const sp = t.home.sponsors
  /* كل شعار يتحرك وحده في خانة ثابتة من الدورة؛ النسختان تجعلان الدورة أعرض من أكبر شاشة. */
  const loopSponsors = [...sponsors, ...sponsors]

  return (
    <section className={`section sponsors ${styles.sponsors}`} id="sponsors">
      {sponsors.length > 0 && <>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{sp.eyebrow}</span>
          <h2>{sp.title}</h2>
          <p className="lead">{sp.lead}</p>
          <div className="divider" />
        </div>
      </div>

      {/* شبكة ثابتة صغيرة بكل الشعارات: الرعاة واضحون دائمًا، والشريط المتحرك تحتها للجمال فقط */}
      <div className="container">
        <ul className={styles.sponsorsGrid} aria-label={sp.eyebrow}>
          {sponsors.map(sponsor => (
            <li className={styles.sponsorTile} key={sponsor.name}>
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                style={{ width: logoWidth(sponsor.ratio) }}
                draggable="false"
              />
            </li>
          ))}
        </ul>
      </div>

      <div
        className={styles.sponsorsMarquee}
        style={{ '--sponsor-count': loopSponsors.length, '--sponsor-duration': `${loopSponsors.length * 3.5}s` }}
        aria-hidden="true"
      >
        {loopSponsors.map((sponsor, i) => (
          <article
            className={styles.sponsorCard}
            key={`${sponsor.name}-${i}`}
            style={{ '--sponsor-index': i }}
          >
            <img
              src={sponsor.logo}
              alt=""
              style={{ width: logoWidth(sponsor.ratio) }}
              draggable="false"
            />
          </article>
        ))}
      </div>

      </>}
      <div className="container">
        <div className={`${styles.sponsorsCta} reveal`}>
          <div>
            <h3>{sp.ctaTitle}</h3>
            <p>{sp.ctaText}</p>
          </div>
          <Link className={`btn btn-primary ${styles.sponsorsCtaBtn}`} to="/sponsor-register">
            {sp.ctaButton} <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ─── */
function CTA() {
  const { t, lang } = useLanguage()
  const c = t.home.cta
  return (
    <section className={`section cta ${styles.cta}`} id="cta">
      <CTATorus />
      <div className="container" style={{position:'relative',zIndex:3,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'22px'}}>
        <span className="eyebrow reveal" style={{alignSelf:'center'}}>{c.eyebrow}</span>
        <h2 className="reveal" style={{fontSize:'clamp(34px,5vw,72px)',fontWeight:900,lineHeight:1.15,letterSpacing:'-0.035em',color:'var(--ink-900)'}}>
          {c.title}
        </h2>
        <p className="reveal" style={{fontSize:'clamp(14px,1.4vw,17px)',color:'var(--ink-500)',maxWidth:'56ch',lineHeight:1.9}}>
          {c.text}
        </p>
        <div className="reveal" style={{display:'flex',flexWrap:'wrap',gap:'12px',justifyContent:'center'}}>
          <Link to="/register" className="btn btn-primary" style={{fontSize:'16px',padding:'19px 38px'}}>
            {c.button} <span className="arrow">→</span>
          </Link>
          <Link to="/tabsur/submit" className="btn btn-ghost" style={{fontSize:'16px',padding:'19px 38px'}}>
            {c.submitButton} <span className="arrow">→</span>
          </Link>
        </div>
        <p className="reveal">{registrationStatus[lang]}</p>
        <span className="reveal" style={{fontSize:'12px',color:'var(--ink-400)',letterSpacing:'0.1em',marginTop:'4px'}}>
          {c.note}
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
