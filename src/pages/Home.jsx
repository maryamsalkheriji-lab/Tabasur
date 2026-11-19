import { Fragment, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import CTATorus from '../components/CTATorus'
import { useHomeAnimations, gsap } from '../lib/animations'
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

/* ─── Prizes ─── */
const PRIZE_TRACKS = [
  { id: 'inperson', amounts: [10000, 7000, 5000] },
  { id: 'remote', amounts: [4000, 3000, 2000] },
]
const PRIZE_TOTAL = PRIZE_TRACKS.reduce((sum, track) => sum + track.amounts.reduce((a, b) => a + b, 0), 0)
const PRIZE_COLORS = ['#0ABD70', '#7FDEB2', '#C4AEDC', '#FFFFFF', '#45CE90']
const money = value => Math.round(value).toLocaleString('en-US')

// رمز الريال السعودي الرسمي (البنك المركزي السعودي)
function Riyal({ className, label }) {
  return (
    <svg className={className} viewBox="0 0 1124.14 1256.39" role="img" aria-label={label} fill="currentColor">
      <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" />
      <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" />
    </svg>
  )
}

function Prizes() {
  const { t } = useLanguage()
  const p = t.home.prizes
  const sectionRef = useRef(null)

  // الحركة: عدّاد المبالغ وصعود منصّة التتويج عند ظهور القسم، ثم قصاصات احتفالية مرة واحدة.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const countUp = (el, duration, delay = 0) => {
      const target = Number(el.dataset.count)
      const state = { value: 0 }
      el.textContent = '0'
      return gsap.to(state, { value: target, duration, delay, ease: 'power2.out', onUpdate: () => { el.textContent = money(state.value) }, onComplete: () => { el.textContent = money(target) } })
    }
    const ctx = gsap.context(() => {
      const total = section.querySelector('[data-prize-total]')
      gsap.set(total, { opacity: 0, y: 30, scale: 0.97 })
      gsap.to(total, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: total, start: 'top 88%', once: true, onEnter: () => countUp(total.querySelector('[data-count]'), 2.2) } })

      section.querySelectorAll('[data-prize-track]').forEach((track, trackIndex) => {
        const head = track.querySelector('[data-prize-head]')
        const cards = track.querySelectorAll('[data-prize-card]')
        const counts = track.querySelectorAll('[data-prize-card] [data-count]')
        gsap.set(head, { opacity: 0, y: 20 })
        gsap.set(cards, { opacity: 0, y: 46, scale: 0.94 })
        const timeline = gsap.timeline({ scrollTrigger: { trigger: track, start: 'top 80%', once: true } })
        timeline.to(head, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
        cards.forEach((card, place) => {
          const at = 0.15 + place * 0.2
          timeline.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'back.out(1.3)', clearProps: 'transform' }, at)
          timeline.add(() => countUp(counts[place], place === 0 ? 1.8 : 1.3), at + 0.15)
        })
        if (trackIndex === 0) timeline.add(() => {
          import('canvas-confetti').then(({ default: confetti }) => {
            const box = cards[0].getBoundingClientRect()
            const origin = { x: (box.left + box.width / 2) / window.innerWidth, y: Math.min(0.9, Math.max(0.2, (box.top + box.height * 0.4) / window.innerHeight)) }
            confetti({ particleCount: 90, spread: 78, startVelocity: 38, scalar: 0.9, ticks: 160, origin, colors: PRIZE_COLORS, disableForReducedMotion: true })
          }).catch(() => {})
        }, 1.1)
      })
      gsap.from(section.querySelectorAll('[data-prize-note]'), { opacity: 0, y: 16, duration: 0.6, stagger: 0.12, ease: 'power2.out', scrollTrigger: { trigger: section.querySelector('[data-prize-notes]'), start: 'top 92%', once: true } })
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className={`section ${styles.prizes}`} id="prizes">
      <span className={styles.prizesGlow} aria-hidden="true" />
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{p.eyebrow}</span>
          <h2>{p.title}</h2>
          <p className="lead">{p.lead}</p>
          <div className="divider" />
        </div>

        <div className={styles.prizePool} data-prize-total>
          <span className={styles.prizePoolShape} aria-hidden="true" />
          <div className={styles.prizePoolText}>
            <span className={styles.prizePoolLabel}>{p.totalLabel}</span>
            <strong className={styles.prizePoolAmount} dir="ltr"><Riyal className={styles.riyalBig} label={p.currency} /><bdi data-count={PRIZE_TOTAL}>{money(PRIZE_TOTAL)}</bdi></strong>
            <span className={styles.prizePoolNote}>{p.totalNote}</span>
          </div>
          <span className={styles.prizePoolTrophy} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8.5 20h7v-2h-7v2Z" /></svg>
          </span>
        </div>

        {PRIZE_TRACKS.map(track => (
          <div key={track.id} className={`${styles.prizeTrack} ${track.id === 'remote' ? styles.prizeTrackRemote : ''}`} data-prize-track>
            <h3 className={styles.prizeTrackHead} data-prize-head><span>{p.tracks[track.id].name}</span></h3>
            <ol className={styles.prizeCards}>
              {track.amounts.map((amount, place) => (
                <li key={place} className={`${styles.prizeCard} ${place === 0 ? styles.prizeCardFirst : ''}`} data-prize-card>
                  <span className={styles.prizeGhost} aria-hidden="true">{place + 1}</span>
                  {place === 0
                    ? <div className={styles.prizeCardTop}><span className={styles.prizeBadge}>{p.places[0]}</span></div>
                    : <span className={styles.prizeRank} aria-hidden="true">{place + 1}</span>}
                  <div className={styles.prizeCardBottom}>
                    <span className={styles.prizeCardLabel}>{place === 0 ? p.valueLabel : p.places[place]}</span>
                    <strong className={styles.amount} dir="ltr"><Riyal className={styles.riyal} label={p.currency} /><bdi data-count={amount}>{money(amount)}</bdi></strong>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}

        <ul className={styles.prizeNotes} data-prize-notes>
          {p.notes.map(note => <li key={note} data-prize-note>{note}</li>)}
        </ul>
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
      <Prizes />
      <Outputs />
      <Partners />
      <Sponsors />
      <CTA />
    </>
  )
}
