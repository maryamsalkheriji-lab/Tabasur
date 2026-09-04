import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const A = '/assets/cubex/'

const DICT = {
  ar: {
    nav: { sub: 'ابتكار · ريادة أعمال', about: 'من نحن', services: 'خدماتنا', programs: 'برامجنا', value: 'الأثر', leadership: 'القيادة', contact: 'تواصل معنا', langCurrent: 'AR', langAr: 'العربية', langEn: 'English' },
    hero: { badge: 'شريكك في الابتكار وريادة الأعمال', kicker: 'FROM CHALLENGE TO VENTURE', title1: 'من التحدّي إلى الفرصة،', title2: 'ومن الفكرة إلى الأثر', desc: 'نساعد الجهات الحكومية والقطاع الخاص على تحويل التحديات المعقدة إلى حلول قابلة للتنفيذ.', cta1: 'استكشف برامجنا ←', cta2: 'تعرّف علينا', stat1n: '٠١', stat1: 'أول معسكر: تَبصِّر', stat2n: '٠٨', stat2: 'برامج ابتكار', stat3n: '٠٥', stat3: 'مراحل عمل', stat4n: '∞', stat4: 'شبكة خبراء' },
    about: { eyebrow: 'من نحن', title: 'من فكرة طموحة إلى قيمة حقيقية', desc: 'أربع مراحل تحوّل التحدي إلى مشروع.', cards: [
      { tag: 'DISCOVERY', title: 'اكتشاف', desc: 'نفهم التحدي وسياقه قبل أي حل.' },
      { tag: 'DESIGN', title: 'تصميم', desc: 'نبني البرنامج والحل المناسب.' },
      { tag: 'AI', title: 'تقنية', desc: 'نوظّف الذكاء الاصطناعي حيث يصنع فرقًا.' },
      { tag: 'VENTURE', title: 'نمو', desc: 'نحوّل الحل إلى مشروع قابل للنمو.' }
    ]},
    services: { eyebrow: 'خدماتنا', title: 'من البرنامج إلى المنتج', desc: 'نُشغّل كل مرحلة بخبرة ميدانية.', items: [
      { tag: '01', title: 'برامج الابتكار', desc: 'تصميم وتشغيل برامج تربط التحديات بالحلول.' },
      { tag: '02', title: 'الذكاء الاصطناعي', desc: 'توظيف الذكاء الاصطناعي في تطوير حلول حقيقية.' },
      { tag: '03', title: 'معسكرات وهاكاثونات', desc: 'تجارب مكثفة تنتهي بمخرجات جاهزة للنشر.' },
      { tag: '04', title: 'بناء الشركات', desc: 'من الفكرة إلى شركة ناشئة قابلة للنمو.' }
    ]},
    programs: { eyebrow: 'برامجنا وفعالياتنا', title: 'ما نُشغّله الآن',
      tabsur: { badge: 'التسجيل مفتوح', title: 'معسكر تَبصِّر', sub: 'TABSUR · تسويق المدن', desc: '٤ أيام لرواية تحوّل المدينة المنورة بصريًا.', cta: 'زيارة الموقع ←' },
      madinah: { badge: 'قريبًا', title: 'مدينة تِك', desc: 'فعالية تقنية تجمع المواهب وروّاد الأعمال.', meta: 'الموعد يُعلن لاحقًا' },
      medai: { badge: 'قريبًا', title: 'هاكاثون ملتقى الذكاء الاصطناعي', desc: 'تحدٍّ تقني لحلول ذكية لمشكلات حقيقية.', meta: 'فِرَق من ٢–٤' }
    },
    value: { eyebrow: 'الأثر', title: 'ما الذي نمكّنه فعليًا', points: ['قرارات أوضح وتسريع تطوير الأفكار', 'مبادرات بأهداف واضحة', 'خبرات وشراكات مؤثرة', 'رفع جاهزية الفرق', 'تقليل مخاطر التنفيذ', 'قياس النتائج وفرص نمو مستدامة'] },
    network: { eyebrow: 'شبكة الخبرات', title: 'الابتكار لا يحدث منفردًا', tags: ['الابتكار', 'ريادة الأعمال', 'الاستثمار', 'تطوير الأعمال', 'التصميم', 'التحول المؤسسي', 'الذكاء الاصطناعي', 'خبرات قطاعية'] },
    leadership: { kicker: 'CEO', name: 'وفاء العمري', role: 'الرئيس التنفيذي', bio: 'تقود كيوبكس من فهم عميق للتحديات المؤسسية.', extra: 'تصميم البرامج، وبناء الشراكات، وتحويل المبادرة إلى نتيجة — هذا ما يقودها كل يوم.', tags: ['منظومات الابتكار', 'ريادة الأعمال', 'الشراكات الاستراتيجية'] },
    contact: { title: 'عندك تحدٍّ يستحق حلًّا؟', desc: 'ابدأ معنا من التحدي.', cta1: 'تواصل مع كيوبكس ←', cta2: 'موقع معسكر تَبصِّر' },
    footer: { tagline: 'شريكك من التحدي إلى الفرصة، ومن الفكرة إلى الأثر', desc: 'نصمّم وننفّذ منظومات الابتكار وريادة الأعمال.', colCompany: 'الشركة', colPrograms: 'البرامج', colContact: 'تواصل', linkAbout: 'من نحن', linkServices: 'خدماتنا', linkLeadership: 'القيادة', linkTabsur: 'معسكر تَبصِّر', linkMadinah: 'مدينة تِك — قريبًا', linkMedai: 'هاكاثون MED AI — قريبًا', copyright: '© ٢٠٢٦ كيوبكس · جميع الحقوق محفوظة', mono: 'FROM CHALLENGE TO VENTURE' }
  },
  en: {
    nav: { sub: 'Innovation · Ventures', about: 'About', services: 'Services', programs: 'Programs', value: 'Impact', leadership: 'Leadership', contact: 'Contact', langCurrent: 'EN', langAr: 'العربية', langEn: 'English' },
    hero: { badge: 'Your partner in innovation & ventures', kicker: 'FROM CHALLENGE TO VENTURE', title1: 'From challenge to opportunity,', title2: 'from idea to impact', desc: 'We help government and private organizations turn complex challenges into solutions that ship.', cta1: 'Explore our programs →', cta2: 'About CubeX', stat1n: '01', stat1: 'First camp: Tabsur', stat2n: '08', stat2: 'Innovation programs', stat3n: '05', stat3: 'Delivery stages', stat4n: '∞', stat4: 'Expert network' },
    about: { eyebrow: 'About', title: 'From ambitious idea to real value', desc: 'Four stages that turn a challenge into a venture.', cards: [
      { tag: 'DISCOVERY', title: 'Discover', desc: 'We understand the challenge before the solution.' },
      { tag: 'DESIGN', title: 'Design', desc: 'We shape the right program and solution.' },
      { tag: 'AI', title: 'Technology', desc: 'We apply AI where it truly matters.' },
      { tag: 'VENTURE', title: 'Grow', desc: 'We turn the solution into a scalable venture.' }
    ]},
    services: { eyebrow: 'Services', title: 'From program to product', desc: 'We run every stage with hands-on expertise.', items: [
      { tag: '01', title: 'Innovation Programs', desc: 'Designing and running programs that link challenges to solutions.' },
      { tag: '02', title: 'Applied AI', desc: 'Using AI to develop real, working solutions.' },
      { tag: '03', title: 'Camps & Hackathons', desc: 'Intensive experiences that end in shippable output.' },
      { tag: '04', title: 'Venture Building', desc: 'From idea to a scalable startup.' }
    ]},
    programs: { eyebrow: 'Programs & Events', title: 'What we run now',
      tabsur: { badge: 'Registration open', title: 'Tabsur Camp', sub: 'TABSUR · CITY MARKETING', desc: "4 days retelling Madinah's transformation, visually.", cta: 'Visit website →' },
      madinah: { badge: 'Coming soon', title: 'Madinah Tech', desc: 'A tech event for talent and entrepreneurs.', meta: 'Date announced soon' },
      medai: { badge: 'Coming soon', title: 'AI Forum Hackathon', desc: 'A technical challenge for real-world AI solutions.', meta: 'Teams of 2–4' }
    },
    value: { eyebrow: 'Impact', title: 'What we actually enable', points: ['Clearer decisions & faster ideas', 'Initiatives with clear goals', 'Expert & strategic partners', 'Stronger team readiness', 'Lower execution risk', 'Measurable results & growth'] },
    network: { eyebrow: 'Expert Network', title: "Innovation doesn't happen alone", tags: ['Innovation', 'Entrepreneurship', 'Investment', 'Business Development', 'Design', 'Institutional Transformation', 'Applied AI', 'Sector Expertise'] },
    leadership: { kicker: 'CEO', name: 'Wafa Alomari', role: 'Chief Executive Officer', bio: 'Leads CubeX with a deep understanding of institutional challenges.', extra: 'Program design, partnerships, and turning initiative into results — every day.', tags: ['Innovation Systems', 'Entrepreneurship', 'Strategic Partnerships'] },
    contact: { title: 'Have a challenge worth solving?', desc: 'Start with us — from challenge to venture.', cta1: 'Talk to CubeX →', cta2: 'Visit Tabsur Camp' },
    footer: { tagline: 'From challenge to opportunity, from idea to impact', desc: 'We design and run innovation & venture systems.', colCompany: 'Company', colPrograms: 'Programs', colContact: 'Contact', linkAbout: 'About', linkServices: 'Services', linkLeadership: 'Leadership', linkTabsur: 'Tabsur Camp', linkMadinah: 'Madinah Tech — soon', linkMedai: 'MED AI Hackathon — soon', copyright: '© 2026 CubeX · All rights reserved', mono: 'FROM CHALLENGE TO VENTURE' }
  }
}

const PATTERNS = [
  ['.XXXX.', '.XXXX.', '.XXHX.', '.XXHX.', '.XXXX.', '......'],
  ['..XX..', '.X..X.', 'X.H..X', 'X.H..X', 'X....X', 'X....X'],
  ['XX.HXX', 'X.XH.X', '.XXHX.', 'X.XH.X', 'XX.HXX', '.XXHX.'],
  ['......', '......', '......', '......', 'XXHHXX', 'XXXXXX']
]
function buildCells(i) {
  const cells = []
  PATTERNS[i].forEach((row) => row.split('').forEach((ch) => {
    cells.push(ch === 'H' ? '#A96BFF' : ch === 'X' ? 'rgba(179,166,199,.55)' : 'transparent')
  }))
  return cells
}
function revealStyle(open) {
  return { maxHeight: open ? 160 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height .45s cubic-bezier(.2,.7,.2,1), opacity .3s ease' }
}
const NOTE_BG = ['#1B0F30', '#241041', '#150C24']
const NOTE_ROT = [-2.2, 1.8, -1.4, 2.1, -1.7, 1.5]
const BAR_BASE = [[8, 18, 26, 12, 20], [16, 24, 10, 22, 14], [20, 12, 18, 26, 10], [10, 22, 16, 8, 24]]
function buildBars(i, open) {
  return BAR_BASE[i % BAR_BASE.length].map((h) => ({ width: 5, height: open ? h * 1.45 : h, background: '#A96BFF', borderRadius: 2, transition: 'height .4s cubic-bezier(.2,.7,.2,1)' }))
}
function slideDescStyle(open) {
  return { marginTop: 8, fontSize: 13.5, lineHeight: 1.75, color: '#9C8FB4', opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity .35s ease, transform .35s ease' }
}
function noteStyle(i) {
  return { background: NOTE_BG[i % NOTE_BG.length], border: '1px solid rgba(150,76,255,.28)', borderRadius: 20, padding: '20px 22px 24px', minHeight: 150, display: 'flex', flexDirection: 'column', transform: `rotate(${NOTE_ROT[i % NOTE_ROT.length]}deg)`, boxShadow: '0 20px 40px -22px rgba(0,0,0,.75)' }
}

const pill = { display: 'inline-flex', padding: '7px 15px', borderRadius: 999, background: 'rgba(150,76,255,.12)', border: '1px solid rgba(150,76,255,.26)', fontSize: 12.5, fontWeight: 600, color: '#C9A6FF' }

export default function CubeX() {
  const [lang, setLang] = useState('ar')
  const [langOpen, setLangOpen] = useState(false)
  const [hoverCard, setHoverCard] = useState(null)
  const [hoverService, setHoverService] = useState(null)
  const [wafaHover, setWafaHover] = useState(false)
  const navRef = useRef(null)
  const t = DICT[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    const onDoc = (e) => { if (langOpen && navRef.current && !navRef.current.contains(e.target)) setLangOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [langOpen])

  useEffect(() => {
    let ticking = false
    const applyParallax = () => {
      const vh = window.innerHeight
      document.querySelectorAll('[data-parallax]').forEach((el) => {
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0
        const r = el.getBoundingClientRect()
        const offset = (r.top + r.height / 2 - vh / 2) * speed
        el.style.transform = `translateY(${offset}px)`
      })
    }
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { applyParallax(); ticking = false }) }
    window.addEventListener('scroll', onScroll, { passive: true })
    applyParallax()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const hidden = []
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.style.animation = 'cxRise .9s cubic-bezier(.22,.7,.2,1) forwards'
        io.unobserve(e.target)
      })
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 })
    document.querySelectorAll('[data-rise]').forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.94) { el.style.opacity = '0'; hidden.push(el); io.observe(el) }
    })
    const failsafe = setTimeout(() => hidden.forEach((el) => { if (el.style.opacity === '0') el.style.opacity = '1' }), 6000)
    return () => { io.disconnect(); clearTimeout(failsafe) }
  }, [lang])

  const capCards = t.about.cards.map((c, i) => ({ ...c, cells: buildCells(i), open: hoverCard === i }))
  const serviceCards = t.services.items.map((c, i) => ({ ...c, bars: buildBars(i, hoverService === i), open: hoverService === i }))
  const valueCards = t.value.points.map((text, i) => ({ text, numLabel: String(i + 1).padStart(2, '0'), style: noteStyle(i) }))

  return (
    <div dir={dir} lang={lang} style={{ direction: dir, background: '#07040E', overflowX: 'hidden', color: '#EDE7F7', fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", lineHeight: 1.75 }}>
      <style>{`
        @keyframes cxRise{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
        @keyframes cxFloat{0%{transform:translate3d(0,0,0) rotate(0deg)}50%{transform:translate3d(0,-18px,0) rotate(2.5deg)}100%{transform:translate3d(0,0,0) rotate(0deg)}}
        @keyframes cxPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
        @keyframes cxGlow{0%,100%{opacity:.5}50%{opacity:.85}}
        @keyframes cxRoll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .cx a{color:#A96BFF;text-decoration:none} .cx a:hover{color:#C9A6FF}
        .cx ::selection{background:#964CFF;color:#fff}
      `}</style>
      <div className="cx">

        <nav ref={navRef} style={{ position: 'sticky', top: 0, zIndex: 80, background: 'rgba(7,4,14,.82)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(150,76,255,.14)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)', height: 'clamp(68px,7vw,86px)', display: 'flex', alignItems: 'center', gap: 'clamp(14px,2.6vw,40px)' }}>
            <a href="#top" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 11 }}>
              <img src={A + 'cube-wire.png'} alt="" style={{ height: 34, width: 'auto', filter: 'drop-shadow(0 0 12px rgba(150,76,255,.6))' }} />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: '#fff' }}>Cube<span style={{ color: '#A96BFF' }}>X</span></span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.16em', color: '#7C6E92' }}>{t.nav.sub}</span>
              </span>
            </a>
            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,1.8vw,28px)', overflowX: 'auto' }}>
              {[['#about', t.nav.about], ['#services', t.nav.services], ['#programs', t.nav.programs], ['#value', t.nav.value], ['#leadership', t.nav.leadership]].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 14.5, fontWeight: 500, color: '#B3A6C7', whiteSpace: 'nowrap', padding: '6px 0', borderBottom: '1.5px solid transparent' }}>{label}</a>
              ))}
            </div>
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setLangOpen((o) => !o) }} aria-label="Language" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 13px', borderRadius: 999, border: '1px solid rgba(150,76,255,.28)', color: '#D8CCEC', fontSize: 12.5, fontWeight: 500, background: 'none', cursor: 'pointer' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"></path></svg>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.06em' }}>{t.nav.langCurrent}</span>
                </button>
                {langOpen && (
                  <div style={{ position: 'absolute', top: 48, insetInlineEnd: 0, width: 170, padding: 8, borderRadius: 14, background: '#100A1C', border: '1px solid rgba(150,76,255,.24)', boxShadow: '0 30px 60px -30px rgba(0,0,0,.9)', zIndex: 90 }}>
                    <button onClick={() => { setLang('ar'); setLangOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, background: 'none', cursor: 'pointer' }}>
                      <span style={{ color: lang === 'ar' ? '#fff' : '#D8CCEC' }}>{t.nav.langAr}</span>
                      {lang === 'ar' && <span style={{ color: '#A96BFF' }}>●</span>}
                    </button>
                    <button onClick={() => { setLang('en'); setLangOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, background: 'none', cursor: 'pointer' }}>
                      <span style={{ color: lang === 'en' ? '#fff' : '#D8CCEC' }}>{t.nav.langEn}</span>
                      {lang === 'en' && <span style={{ color: '#A96BFF' }}>●</span>}
                    </button>
                  </div>
                )}
              </div>
              <a href="#contact" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', borderRadius: 999, background: '#964CFF', color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 12px 30px -14px rgba(150,76,255,.9)' }}>{t.nav.contact}</a>
            </div>
          </div>
        </nav>

        <section id="top" style={{ position: 'relative', overflow: 'hidden', background: '#07040E', padding: 'clamp(64px,8vw,120px) 0 clamp(50px,6vw,76px)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 60% at 78% 8%,rgba(150,76,255,.30) 0%,rgba(150,76,255,0) 62%),radial-gradient(55% 55% at 6% 96%,rgba(107,46,204,.26) 0%,rgba(107,46,204,0) 66%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(150,76,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(150,76,255,.05) 1px,transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(80% 70% at 50% 30%,#000 0%,transparent 78%)', WebkitMaskImage: 'radial-gradient(80% 70% at 50% 30%,#000 0%,transparent 78%)' }} />
          <div style={{ position: 'relative', zIndex: 3, maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,.85fr)', gap: 'clamp(24px,4vw,64px)', alignItems: 'center' }}>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', padding: '8px 15px', borderRadius: 999, background: 'rgba(150,76,255,.12)', border: '1px solid rgba(150,76,255,.3)', fontSize: 12.5, fontWeight: 500, color: '#C9A6FF' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A96BFF', animation: 'cxPulse 2.4s ease-in-out infinite' }} />
                  {t.hero.badge}
                </span>
                <p style={{ marginTop: 24, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: '.32em', color: '#8F7BB8' }}>{t.hero.kicker}</p>
                <h1 style={{ marginTop: 14, fontSize: 'clamp(36px,5.6vw,84px)', fontWeight: 800, lineHeight: 1.4, letterSpacing: '-.035em', color: '#fff' }}>{t.hero.title1}<br /><span style={{ color: '#A96BFF' }}>{t.hero.title2}</span></h1>
                <p style={{ marginTop: 20, fontSize: 'clamp(15px,1.3vw,18px)', lineHeight: 1.85, color: '#B3A6C7', maxWidth: '52ch' }}>{t.hero.desc}</p>
                <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: 13 }}>
                  <a href="#programs" style={{ display: 'inline-flex', whiteSpace: 'nowrap', alignItems: 'center', gap: 10, padding: '16px 30px', borderRadius: 999, background: '#964CFF', color: '#fff', fontSize: 15.5, fontWeight: 600, boxShadow: '0 20px 46px -20px rgba(150,76,255,.95)' }}>{t.hero.cta1}</a>
                  <a href="#about" style={{ display: 'inline-flex', whiteSpace: 'nowrap', alignItems: 'center', gap: 10, padding: '16px 28px', borderRadius: 999, border: '1px solid rgba(150,76,255,.32)', color: '#EDE7F7', fontSize: 15.5, fontWeight: 500 }}>{t.hero.cta2}</a>
                </div>
              </div>
              <div style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 'clamp(220px,28vw,420px)' }}>
                <div data-parallax="-0.14" aria-hidden="true" style={{ position: 'absolute', width: '74%', aspectRatio: 1, borderRadius: '50%', background: 'radial-gradient(circle,rgba(150,76,255,.42) 0%,rgba(150,76,255,0) 68%)', animation: 'cxGlow 6s ease-in-out infinite' }} />
                <img src={A + 'cube-wire.png'} alt="CubeX" style={{ position: 'relative', width: 'min(84%,400px)', filter: 'drop-shadow(0 0 40px rgba(150,76,255,.55))', animation: 'cxFloat 11s ease-in-out infinite' }} />
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', zIndex: 3, maxWidth: 1400, margin: 'clamp(40px,5vw,70px) auto 0', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 1, background: 'rgba(150,76,255,.16)', borderTop: '1px solid rgba(150,76,255,.16)', borderBottom: '1px solid rgba(150,76,255,.16)' }}>
              {[[t.hero.stat1n, t.hero.stat1, '#fff'], [t.hero.stat2n, t.hero.stat2, '#A96BFF'], [t.hero.stat3n, t.hero.stat3, '#fff'], [t.hero.stat4n, t.hero.stat4, '#A96BFF']].map(([n, l, c], i) => (
                <div key={i} style={{ background: '#07040E', padding: 'clamp(16px,2vw,26px) clamp(14px,1.8vw,22px)' }}>
                  <strong style={{ display: 'block', fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-.04em', color: c }}>{n}</strong>
                  <span style={{ display: 'block', marginTop: 8, fontSize: 13, color: '#9C8FB4', fontWeight: 500 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" style={{ padding: 'clamp(70px,8.6vw,124px) 0', borderTop: '1px solid rgba(150,76,255,.12)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div data-rise="" style={{ maxWidth: 680 }}>
              <span style={pill}>{t.about.eyebrow}</span>
              <h2 style={{ marginTop: 20, fontSize: 'clamp(27px,3.4vw,50px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.03em', color: '#fff' }}>{t.about.title}</h2>
              <p style={{ marginTop: 14, fontSize: 'clamp(14.5px,1.25vw,17px)', color: '#9C8FB4' }}>{t.about.desc}</p>
            </div>
            <div data-rise="" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              {capCards.map((card, i) => (
                <div key={i} onMouseEnter={() => setHoverCard(i)} onMouseLeave={() => setHoverCard(null)} onClick={() => setHoverCard(i)} style={{ padding: 16, borderRadius: 14, background: '#0E0818', border: '1px solid rgba(150,76,255,.16)', cursor: 'pointer', transition: 'border-color .35s ease' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.16em', color: '#7C6E92' }}>{card.tag}</span>
                  <div style={{ height: 34, display: 'flex', alignItems: 'center', marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,4px)', gridAutoRows: 4, gap: 1 }}>
                      {card.cells.map((c, j) => <span key={j} style={{ width: 4, height: 4, background: c }} />)}
                    </div>
                  </div>
                  <h3 style={{ marginTop: 12, fontSize: 16.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{card.title}</h3>
                  <div style={revealStyle(card.open)}>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: '#9C8FB4', paddingTop: 10 }}>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="services" style={{ padding: 'clamp(70px,8.6vw,124px) 0', background: '#0B0614', borderBlock: '1px solid rgba(150,76,255,.12)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div data-rise="" style={{ maxWidth: 680 }}>
              <span style={pill}>{t.services.eyebrow}</span>
              <h2 style={{ marginTop: 20, fontSize: 'clamp(27px,3.4vw,48px)', fontWeight: 800, lineHeight: 1.16, letterSpacing: '-.03em', color: '#fff' }}>{t.services.title}</h2>
              <p style={{ marginTop: 14, fontSize: 'clamp(14.5px,1.25vw,17px)', color: '#9C8FB4' }}>{t.services.desc}</p>
            </div>
            <div data-rise="" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              {serviceCards.map((card, i) => (
                <div key={i} onMouseEnter={() => setHoverService(i)} onMouseLeave={() => setHoverService(null)} onClick={() => setHoverService(i)} style={{ position: 'relative', overflow: 'hidden', padding: 16, borderRadius: 14, background: '#0E0818', border: '1px solid rgba(150,76,255,.16)', cursor: 'pointer', transition: 'border-color .35s ease' }}>
                  <span aria-hidden="true" style={{ position: 'absolute', top: -6, insetInlineEnd: 6, fontSize: 52, fontWeight: 800, color: 'rgba(150,76,255,.07)', lineHeight: 1, fontFamily: "'IBM Plex Mono',monospace" }}>{card.tag}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.16em', color: '#7C6E92' }}>{card.tag}</span>
                  <div style={{ height: 30, display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 14 }}>
                    {card.bars.map((b, j) => <span key={j} style={b} />)}
                  </div>
                  <h3 style={{ marginTop: 12, fontSize: 16.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{card.title}</h3>
                  <p style={slideDescStyle(card.open)}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="showcase" style={{ position: 'relative', overflow: 'hidden' }}>
          <div data-rise="" style={{ position: 'relative', height: 'clamp(300px,50vw,600px)', overflow: 'hidden' }}>
            <img data-parallax="0.16" src={A + 'hands-cube.jpg'} alt="من الفكرة إلى التنفيذ" style={{ position: 'absolute', inset: '-12% 0', width: '100%', height: '124%', objectFit: 'cover' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(7,4,14,.1) 0%,rgba(7,4,14,.05) 42%,rgba(7,4,14,.82) 100%)' }} />
          </div>
        </section>

        <section id="programs" style={{ padding: 'clamp(70px,8.6vw,124px) 0' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div data-rise="" style={{ maxWidth: 680 }}>
              <span style={pill}>{t.programs.eyebrow}</span>
              <h2 style={{ marginTop: 20, fontSize: 'clamp(27px,3.4vw,48px)', fontWeight: 800, lineHeight: 1.16, letterSpacing: '-.03em', color: '#fff' }}>{t.programs.title}</h2>
            </div>

            <div data-rise="" style={{ marginTop: 36 }}>
              <Link to="/tabsur" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: 'clamp(24px,3vw,40px)', borderRadius: 22, background: 'linear-gradient(100deg,#150C24 0%,#241041 58%,#3A1670 100%)', border: '1px solid rgba(150,76,255,.32)', color: 'inherit' }}>
                <div aria-hidden="true" style={{ position: 'absolute', insetInlineStart: '-6%', top: '-40%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(169,107,255,.32) 0%,rgba(169,107,255,0) 66%)' }} />
                <span style={{ position: 'relative', flex: '0 0 auto', width: 90, height: 90, borderRadius: 18, overflow: 'hidden', background: '#F7EEE5' }}>
                  <img src={A + 'tabsur-logo-black.png'} alt="تَبصِّر" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </span>
                <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 999, background: 'rgba(93,232,168,.16)', border: '1px solid rgba(93,232,168,.3)', fontSize: 11.5, fontWeight: 600, color: '#5DE8A8' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5DE8A8', animation: 'cxPulse 2s ease-in-out infinite' }} />{t.programs.tabsur.badge}
                  </span>
                  <h3 style={{ marginTop: 12, fontSize: 'clamp(20px,2.2vw,28px)', fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{t.programs.tabsur.title}</h3>
                  <span style={{ display: 'block', marginTop: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: '.16em', color: '#8F7BB8' }}>{t.programs.tabsur.sub}</span>
                  <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.8, color: '#B3A6C7', maxWidth: '52ch' }}>{t.programs.tabsur.desc}</p>
                </div>
                <span style={{ position: 'relative', flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14.5, fontWeight: 600, color: '#fff', borderBottom: '1px solid rgba(255,255,255,.35)', paddingBottom: 4 }}>{t.programs.tabsur.cta}</span>
              </Link>
            </div>

            <div data-rise="" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              {[[t.programs.madinah, 'madinah-tech.png', 'Madinah Tech', { mixBlendMode: 'screen' }], [t.programs.medai, 'med-ai.png', 'MED AI', { borderRadius: 6 }]].map(([p, img, alt, imgStyle], i) => (
                <article key={i} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, borderRadius: 16, background: '#0E0818', border: '1px solid rgba(150,76,255,.16)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ display: 'inline-flex', padding: '6px 13px', borderRadius: 999, background: 'rgba(150,76,255,.16)', border: '1px solid rgba(150,76,255,.3)', color: '#C9A6FF', fontSize: 11, fontWeight: 600 }}>{p.badge}</span>
                  </div>
                  <span style={{ height: 44, display: 'flex', alignItems: 'center' }}>
                    <img src={A + img} alt={alt} style={{ height: '100%', width: 'auto', ...imgStyle }} />
                  </span>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{p.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: '#9C8FB4' }}>{p.desc}</p>
                  <span style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(150,76,255,.16)', fontSize: 12.5, color: '#7C6E92' }}>{p.meta}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="value" style={{ padding: 'clamp(70px,8.6vw,124px) 0', background: '#0B0614', borderBlock: '1px solid rgba(150,76,255,.12)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div data-rise="" style={{ maxWidth: 680 }}>
              <span style={pill}>{t.value.eyebrow}</span>
              <h2 style={{ marginTop: 20, fontSize: 'clamp(27px,3.4vw,48px)', fontWeight: 800, lineHeight: 1.16, letterSpacing: '-.03em', color: '#fff' }}>{t.value.title}</h2>
            </div>
            <div data-rise="" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
              {valueCards.map((card, i) => (
                <div key={i} style={card.style}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.35)' }}>{card.numLabel}</span>
                  <p style={{ marginTop: 12, fontSize: 'clamp(15px,1.6vw,18px)', fontWeight: 700, color: '#fff', lineHeight: 1.4, letterSpacing: '-.01em' }}>{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="network" style={{ padding: 'clamp(56px,6.6vw,92px) 0', overflow: 'hidden' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <span style={pill}>{t.network.eyebrow}</span>
            <h2 style={{ marginTop: 18, fontSize: 'clamp(22px,2.6vw,36px)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.03em', color: '#fff' }}>{t.network.title}</h2>
          </div>
          <div style={{ marginTop: 32, overflow: 'hidden', direction: 'ltr', paddingBlock: 8, WebkitMaskImage: 'linear-gradient(to left,transparent 0,#000 8%,#000 92%,transparent 100%)', maskImage: 'linear-gradient(to left,transparent 0,#000 8%,#000 92%,transparent 100%)' }}>
            <div style={{ display: 'flex', width: 'max-content', direction: 'ltr', animation: 'cxRoll 36s linear infinite', willChange: 'transform' }}>
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1} style={{ display: 'flex', flex: 'none' }}>
                  {t.network.tags.map((tag, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: '0 22px', direction: lang === 'ar' ? 'rtl' : 'ltr', fontSize: 'clamp(22px,3.4vw,44px)', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                      {tag}<span style={{ color: '#A96BFF', fontSize: 15 }}>✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="leadership" style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(70px,8.6vw,124px) 0', background: '#0B0614', borderTop: '1px solid rgba(150,76,255,.12)' }}>
          <div data-parallax="0.08" aria-hidden="true" style={{ position: 'absolute', inset: '-10% 0', height: '120%', backgroundImage: `url(${A}bg-grid.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: .24 }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(11,6,20,.35) 0%,rgba(11,6,20,.94) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div data-rise="" onMouseEnter={() => setWafaHover(true)} onMouseLeave={() => setWafaHover(false)} onClick={() => setWafaHover(true)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(150,76,255,.22)', background: '#0E0818', borderRadius: '62% 38% 68% 32% / 48% 62% 38% 52%', aspectRatio: .92 }}>
                <img src={A + 'ceo-wafa.jpg'} alt="وفاء العمري" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.9) contrast(1.04)' }} />
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(150,76,255,.08) 0%,rgba(7,4,14,0) 45%,rgba(7,4,14,.55) 100%)' }} />
              </div>
              <div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.24em', color: '#8F7BB8' }}>{t.leadership.kicker}</span>
                <h2 style={{ marginTop: 14, fontSize: 'clamp(30px,4vw,54px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.035em', color: '#fff' }}>{t.leadership.name}</h2>
                <span style={{ display: 'block', marginTop: 6, fontSize: 14.5, color: '#9C8FB4' }}>{t.leadership.role}</span>
                <p style={{ marginTop: 18, fontSize: 'clamp(14.5px,1.25vw,17px)', lineHeight: 1.9, color: '#B3A6C7', maxWidth: '52ch' }}>{t.leadership.bio}</p>
                <div style={revealStyle(wafaHover)}>
                  <p style={{ fontSize: 14.5, lineHeight: 1.9, color: '#B3A6C7', maxWidth: '52ch', paddingTop: 8 }}>{t.leadership.extra}</p>
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                    {t.leadership.tags.map((wtag, i) => <span key={i} style={{ padding: '9px 16px', borderRadius: 999, background: '#120B1F', border: '1px solid rgba(150,76,255,.22)', fontSize: 13, color: '#D8CCEC' }}>{wtag}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" style={{ position: 'relative', padding: 'clamp(80px,10vw,150px) 0', background: '#07040E', borderTop: '1px solid rgba(150,76,255,.12)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(55% 60% at 50% 0%,rgba(150,76,255,.26) 0%,rgba(150,76,255,0) 66%)' }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 920, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
            <img data-rise="" src={A + 'cube-x.png'} alt="" style={{ width: 'min(200px,50%)', opacity: .95, filter: 'drop-shadow(0 0 30px rgba(150,76,255,.6))' }} />
            <h2 data-rise="" style={{ fontSize: 'clamp(30px,5vw,64px)', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-.04em', color: '#fff' }}>{t.contact.title}</h2>
            <p data-rise="" style={{ fontSize: 'clamp(15px,1.4vw,18px)', lineHeight: 1.9, color: '#B3A6C7', maxWidth: '52ch' }}>{t.contact.desc}</p>
            <div data-rise="" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 13 }}>
              <a href="mailto:info@cubex.com.sa" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 34px', borderRadius: 999, background: '#964CFF', color: '#fff', fontSize: 16, fontWeight: 600, boxShadow: '0 22px 50px -22px rgba(150,76,255,.95)' }}>{t.contact.cta1}</a>
              <Link to="/tabsur" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 30px', borderRadius: 999, border: '1px solid rgba(150,76,255,.32)', color: '#EDE7F7', fontSize: 16, fontWeight: 500 }}>{t.contact.cta2}</Link>
            </div>
          </div>
        </section>

        <footer style={{ background: '#07040E', padding: 'clamp(52px,6vw,84px) 0 0' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(18px,3.4vw,48px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 32 }}>
              <div style={{ maxWidth: '44ch' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <img src={A + 'cube-wire.png'} alt="" style={{ height: 38, width: 'auto', filter: 'drop-shadow(0 0 12px rgba(150,76,255,.6))' }} />
                  <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: '#fff' }}>Cube<span style={{ color: '#A96BFF' }}>X</span></span>
                </span>
                <p style={{ marginTop: 20, fontSize: 15.5, fontWeight: 500, lineHeight: 1.7, color: '#fff' }}>{t.footer.tagline}</p>
                <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.9, color: '#8F82A6' }}>{t.footer.desc}</p>
              </div>
              <div>
                <h5 style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.2em', color: '#A96BFF', fontWeight: 500 }}>{t.footer.colCompany}</h5>
                <ul style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11, listStyle: 'none', padding: 0 }}>
                  <li><a href="#about" style={{ fontSize: 14.5, color: '#9C8FB4' }}>{t.footer.linkAbout}</a></li>
                  <li><a href="#services" style={{ fontSize: 14.5, color: '#9C8FB4' }}>{t.footer.linkServices}</a></li>
                  <li><a href="#leadership" style={{ fontSize: 14.5, color: '#9C8FB4' }}>{t.footer.linkLeadership}</a></li>
                </ul>
              </div>
              <div>
                <h5 style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.2em', color: '#A96BFF', fontWeight: 500 }}>{t.footer.colPrograms}</h5>
                <ul style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11, listStyle: 'none', padding: 0 }}>
                  <li><Link to="/tabsur" style={{ fontSize: 14.5, color: '#9C8FB4' }}>{t.footer.linkTabsur}</Link></li>
                  <li><span style={{ fontSize: 14.5, color: '#6B5F80' }}>{t.footer.linkMadinah}</span></li>
                  <li><span style={{ fontSize: 14.5, color: '#6B5F80' }}>{t.footer.linkMedai}</span></li>
                </ul>
              </div>
              <div>
                <h5 style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.2em', color: '#A96BFF', fontWeight: 500 }}>{t.footer.colContact}</h5>
                <ul style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11, listStyle: 'none', padding: 0 }}>
                  <li><a href="mailto:info@cubex.com.sa" style={{ fontSize: 14.5, color: '#9C8FB4' }}>info@cubex.com.sa</a></li>
                  <li><a href="https://cubex.com.sa" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14.5, color: '#9C8FB4' }}>cubex.com.sa</a></li>
                </ul>
              </div>
            </div>
            <div style={{ marginTop: 40, padding: '22px 0', borderTop: '1px solid rgba(150,76,255,.14)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 13, color: '#6B5F80' }}>{t.footer.copyright}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.18em', color: '#6B5F80' }}>{t.footer.mono}</span>
            </div>
            <div aria-hidden="true" style={{ display: 'flex', height: 3, width: '100%' }}>
              <span style={{ flex: 60, background: '#964CFF' }} /><span style={{ flex: 25, background: '#6B2ECC' }} /><span style={{ flex: 15, background: '#3A1670' }} />
            </div>
            <div aria-hidden="true" style={{ overflow: 'hidden', textAlign: 'center', padding: 'clamp(10px,2vw,26px) 0 clamp(4px,1vw,10px)' }}>
              <span style={{ display: 'inline-block', fontSize: 'clamp(64px,15vw,220px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1, backgroundImage: 'radial-gradient(circle,#A96BFF 1.4px,transparent 1.6px)', backgroundSize: '6px 6px', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }}>CubeX</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
