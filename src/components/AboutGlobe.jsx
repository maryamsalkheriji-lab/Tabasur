import { useRef, useEffect, useState, useCallback } from 'react'
import Globe from 'react-globe.gl'

/**
 * AboutGlobe — كرة أرضية واقعية تدور ثم تقرّب على المدينة المنورة.
 *
 * التركيب (Drop-in):
 *   ضع هذا الملف مكان AboutGlobe القديم. الكومبوننت يملأ أقرب حاوية
 *   لها position: relative (نفس سلوك inset:0 في النسخة السابقة).
 *
 * الاعتمادية الوحيدة:
 *   npm i react-globe.gl     (يسحب معه three.js تلقائياً)
 *
 * الخامات (textures) تُحمَّل من شبكة three-globe. لبيئة بدون إنترنت،
 * نزّل earth-blue-marble.jpg و earth-topology.png وبدّل TEX/BUMP بمسار محلي.
 */

// ——— الموقع وألوان الهوية ———
const MED = { lat: 24.4672, lng: 39.6111 } // المدينة المنورة
const NAVY = '#1F3D52'
const GREEN = '#34A876'
const GOLD = '#E0A24B'

// مراجع بيانات ثابتة — لا تُعاد صياغتها مع كل render
// (وإلا يعيد react-globe.gl بناء علامة المدينة ويفقد حالتها)
const RINGS = [{ lat: MED.lat, lng: MED.lng }]
const MARKERS = [{ lat: MED.lat, lng: MED.lng }]
const ARCS = [
  { startLat: 21.4225, startLng: 39.8262, endLat: MED.lat, endLng: MED.lng }, // مكة
  { startLat: 24.7136, startLng: 46.6753, endLat: MED.lat, endLng: MED.lng }, // الرياض
  { startLat: 26.0667, startLng: 50.5577, endLat: MED.lat, endLng: MED.lng }, // الخليج
]

const TEX = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png'

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ——— أنماط علامة المدينة (تُحقن مرة واحدة) ———
const MARKER_CSS = `
.agm-mk{position:relative;pointer-events:none;display:flex;flex-direction:column;align-items:center;opacity:0;transition:opacity .7s ease;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;direction:rtl;}
.agm-card{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.97);border:1px solid rgba(52,168,118,.30);border-radius:13px;padding:8px 12px 8px 10px;box-shadow:0 14px 30px rgba(15,30,42,.18);white-space:nowrap;}
.agm-glyph{width:30px;height:30px;flex:0 0 auto;position:relative;display:grid;place-items:end center;}
.agm-glyph .dome{width:18px;height:9px;background:${GREEN};border-radius:9px 9px 0 0;position:relative;z-index:2;}
.agm-glyph .finial{position:absolute;left:50%;top:1px;transform:translateX(-50%);width:3px;height:5px;border-radius:2px;background:${GOLD};z-index:3;}
.agm-glyph .base{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:24px;height:9px;background:rgba(69,56,46,.16);border-radius:2px;z-index:1;}
.agm-glyph .min{position:absolute;bottom:0;width:3px;height:18px;border-radius:2px 2px 0 0;background:${GREEN};opacity:.85;z-index:1;}
.agm-glyph .min.l{left:1px;}
.agm-glyph .min.r{right:1px;}
.agm-glyph .min::before{content:"";position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:5px;height:4px;border-radius:3px 3px 0 0;background:${GOLD};}
.agm-txt{display:flex;flex-direction:column;gap:1px;}
.agm-txt .t1{font-size:13px;font-weight:700;color:${NAVY};line-height:1;}
.agm-txt .t2{font-size:10px;font-weight:500;color:${GREEN};line-height:1;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em;}
.agm-line{width:1.5px;height:26px;margin-top:5px;background:linear-gradient(to bottom, rgba(224,162,75,.86), rgba(224,162,75,0));}
.agm-foot{width:9px;height:9px;border-radius:50%;background:${GOLD};box-shadow:0 0 0 4px rgba(224,162,75,.18), 0 0 16px 3px rgba(201,97,78,.34);}
/* فراغ سفلي يبقي النقطة المتوهجة في منتصف العلامة، كي تستقر تماماً على المدينة */
.agm-spacer{height:80px;width:1px;}
`

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('agm-styles')) return
  const el = document.createElement('style')
  el.id = 'agm-styles'
  el.textContent = MARKER_CSS
  document.head.appendChild(el)
}

function buildMarker(revealed) {
  const el = document.createElement('div')
  el.className = 'agm-mk'
  el.innerHTML = `
    <div class="agm-card">
      <div class="agm-glyph">
        <span class="min l"></span><span class="min r"></span>
        <span class="base"></span>
        <span class="dome"></span><span class="finial"></span>
      </div>
      <div class="agm-txt"><span class="t1">المدينة المنورة</span><span class="t2">AL MADINAH</span></div>
    </div>
    <div class="agm-line"></div>
    <div class="agm-foot"></div>
    <div class="agm-spacer"></div>`
  if (revealed) el.style.opacity = '1'
  return el
}

export default function AboutGlobe() {
  const wrapRef = useRef(null)
  const globeEl = useRef(null)
  const markerRef = useRef(null)
  const revealedRef = useRef(false)
  const [size, setSize] = useState({ w: 480, h: 480 })

  useEffect(() => { ensureStyles() }, [])

  // قياس الحاوية الأم
  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    measure()
    return () => ro.disconnect()
  }, [])

  // تسلسل الدخول: دوران ثم تقريب على المدينة المنورة
  const runIntro = useCallback(() => {
    const g = globeEl.current
    if (!g) return
    revealedRef.current = false
    if (markerRef.current) markerRef.current.style.opacity = '0'

    const controls = g.controls()
    controls.enableZoom = false
    controls.enablePan = false
    controls.minDistance = 160
    controls.maxDistance = 520

    if (REDUCE) {
      controls.autoRotate = false
      g.pointOfView({ lat: MED.lat, lng: MED.lng, altitude: 1.1 }, 0)
      revealedRef.current = true
      if (markerRef.current) markerRef.current.style.opacity = '1'
      return
    }

    controls.autoRotate = true
    controls.autoRotateSpeed = 1.7
    g.pointOfView({ lat: 14, lng: 18, altitude: 2.7 }, 0)

    const t1 = setTimeout(() => {
      controls.autoRotate = false
      g.pointOfView({ lat: MED.lat, lng: MED.lng, altitude: 0.7 }, 3600)
    }, 1500)

    const t2 = setTimeout(() => {
      revealedRef.current = true
      if (markerRef.current) markerRef.current.style.opacity = '1'
    }, 5000)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!globeEl.current) return
    return runIntro()
  }, [runIntro])

  const htmlEl = useCallback(() => {
    const el = buildMarker(revealedRef.current)
    markerRef.current = el
    return el
  }, [])

  // النقر يعيد الرحلة (يُتجاهَل عند تفضيل تقليل الحركة)
  const replay = useCallback(() => { if (!REDUCE) runIntro() }, [runIntro])

  return (
    <div
      ref={wrapRef}
      onClick={replay}
      tabIndex={0}
      aria-label="كرة أرضية تفاعلية تقرّب على موقع المدينة المنورة"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        clipPath: 'circle(50% at 50% 50%)',
        overflow: 'hidden',
        outline: 'none',
        cursor: 'pointer',
        direction: 'rtl',
      }}
    >
      <Globe
        ref={globeEl}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={TEX}
        bumpImageUrl={BUMP}
        showAtmosphere
        atmosphereColor="#90D6B5"
        atmosphereAltitude={0.18}
        ringsData={RINGS}
        ringColor={() => (t) => `rgba(201,97,78,${1 - t})`}
        ringMaxRadius={5.5}
        ringPropagationSpeed={2.4}
        ringRepeatPeriod={850}
        ringAltitude={0.006}
        arcsData={ARCS}
        arcColor={() => ['rgba(156,141,184,0)', 'rgba(156,141,184,.90)']}
        arcStroke={0.5}
        arcDashLength={0.45}
        arcDashGap={0.25}
        arcDashAnimateTime={2600}
        arcAltitudeAutoScale={0.45}
        pointsData={MARKERS}
        pointColor={() => GOLD}
        pointAltitude={0.01}
        pointRadius={0.32}
        htmlElementsData={MARKERS}
        htmlElement={htmlEl}
        htmlAltitude={0.06}
      />
    </div>
  )
}
