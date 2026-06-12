import { useEffect, useRef } from 'react'
import { THREE, BRAND } from '../lib/three-setup'

const MADINAH = {
  lat: 24.4709,
  lon: 39.6111,
}

function toRad(value) {
  return value * Math.PI / 180
}

function latLonToVector3(lat, lon, radius) {
  const phi = toRad(lat)
  const theta = toRad(lon)

  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(theta),
  )
}

function drawLand(ctx, points, width, height) {
  ctx.beginPath()
  points.forEach(([lon, lat], index) => {
    const x = ((lon + 180) / 360) * width
    const y = ((90 - lat) / 180) * height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fill()
}

function createEarthTexture() {
  const width = 2048
  const height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const ocean = ctx.createLinearGradient(0, 0, width, height)
  ocean.addColorStop(0, '#dfeee9')
  ocean.addColorStop(0.45, '#b9d7d3')
  ocean.addColorStop(1, '#7fb0a9')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(244, 236, 211, 0.94)'
  const landMasses = [
    [[-170, 72], [-132, 72], [-102, 58], [-82, 48], [-70, 26], [-86, 14], [-112, 18], [-130, 32], [-154, 54]],
    [[-82, 12], [-62, 8], [-48, -10], [-52, -34], [-66, -54], [-78, -42], [-72, -18]],
    [[-18, 36], [10, 36], [34, 22], [46, 5], [38, -30], [18, -36], [2, -20], [-12, 8]],
    [[-10, 72], [38, 72], [68, 58], [88, 48], [122, 52], [154, 40], [136, 16], [104, 8], [72, 20], [44, 18], [28, 32], [8, 42]],
    [[34, 32], [58, 30], [74, 22], [66, 8], [46, 10], [36, 22]],
    [[112, -10], [154, -12], [166, -28], [148, -44], [118, -34]],
    [[-180, -62], [180, -62], [180, -88], [-180, -88]],
  ]
  landMasses.forEach(points => drawLand(ctx, points, width, height))

  ctx.strokeStyle = 'rgba(31, 61, 82, 0.16)'
  ctx.lineWidth = 1
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  const madinahX = ((MADINAH.lon + 180) / 360) * width
  const madinahY = ((90 - MADINAH.lat) / 180) * height
  const glow = ctx.createRadialGradient(madinahX, madinahY, 0, madinahX, madinahY, 70)
  glow.addColorStop(0, 'rgba(201, 97, 78, 0.95)')
  glow.addColorStop(0.26, 'rgba(201, 97, 78, 0.28)')
  glow.addColorStop(1, 'rgba(201, 97, 78, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(madinahX - 80, madinahY - 80, 160, 160)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export default function AboutSphere() {
  const canvasRef = useRef(null)
  const hoverRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 0.12, 4.6)

    const globe = new THREE.Group()
    scene.add(globe)

    const earthTexture = createEarthTexture()
    const earthGeometry = new THREE.SphereGeometry(1.45, 96, 64)
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.74,
      metalness: 0.03,
    })
    const earth = new THREE.Mesh(earthGeometry, earthMaterial)
    globe.add(earth)

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.457, 48, 24),
      new THREE.MeshBasicMaterial({
        color: BRAND.green,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
      }),
    )
    globe.add(wire)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 64, 32),
      new THREE.MeshBasicMaterial({
        color: BRAND.mauve,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    scene.add(atmosphere)

    const madinahPoint = latLonToVector3(MADINAH.lat, MADINAH.lon, 1.49)
    const marker = new THREE.Group()
    marker.position.copy(madinahPoint)
    marker.lookAt(madinahPoint.clone().multiplyScalar(2))
    globe.add(marker)

    const markerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 20, 12),
      new THREE.MeshBasicMaterial({ color: BRAND.coral }),
    )
    marker.add(markerDot)

    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.082, 36),
      new THREE.MeshBasicMaterial({
        color: BRAND.coral,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    marker.add(markerRing)

    const particlesCount = 110
    const positions = new Float32Array(particlesCount * 3)
    const colors = new Float32Array(particlesCount * 3)
    for (let i = 0; i < particlesCount; i++) {
      const u = Math.random() * Math.PI * 2
      const v = Math.acos(2 * Math.random() - 1)
      const r = 1.92 + Math.random() * 0.2
      positions[i * 3 + 0] = r * Math.sin(v) * Math.cos(u)
      positions[i * 3 + 1] = r * Math.sin(v) * Math.sin(u)
      positions[i * 3 + 2] = r * Math.cos(v)
      const color = i % 5 === 0 ? BRAND.gold : (i % 2 === 0 ? BRAND.green : BRAND.mauve)
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    scene.add(new THREE.AmbientLight(0xffffff, 1.85))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(3, 2.5, 5)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(BRAND.green, 1.1)
    rimLight.position.set(-4, -1, -2)
    scene.add(rimLight)

    function resize() {
      const rect = canvas.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      camera.aspect = rect.width / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', resize)
    resize()

    const focusedRotation = {
      x: toRad(MADINAH.lat),
      y: -toRad(MADINAH.lon),
      z: -0.05,
    }
    let rafId

    function tick(time) {
      const hover = hoverRef.current
      const ease = hover ? 0.075 : 0.035
      const idleY = time * 0.00013
      const targetX = hover ? focusedRotation.x : Math.sin(time * 0.00018) * 0.16
      const targetY = hover ? focusedRotation.y : idleY
      const targetZ = hover ? focusedRotation.z : Math.sin(time * 0.00011) * 0.05
      const targetCameraZ = hover ? 2.68 : 4.6
      const targetCameraY = hover ? 0.04 : 0.12

      globe.rotation.x += (targetX - globe.rotation.x) * ease
      globe.rotation.y += (targetY - globe.rotation.y) * ease
      globe.rotation.z += (targetZ - globe.rotation.z) * ease
      camera.position.z += (targetCameraZ - camera.position.z) * ease
      camera.position.y += (targetCameraY - camera.position.y) * ease
      camera.lookAt(0, 0, 0)

      markerRing.scale.setScalar(1 + Math.sin(time * 0.004) * 0.18)
      markerRing.material.opacity = hover ? 0.95 : 0.62
      atmosphere.scale.setScalar(1 + Math.sin(time * 0.001) * 0.018)
      particles.rotation.y = time * 0.00008
      particles.rotation.x = Math.sin(time * 0.00012) * 0.18

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      earthGeometry.dispose()
      earthMaterial.dispose()
      earthTexture.dispose()
      wire.geometry.dispose()
      wire.material.dispose()
      atmosphere.geometry.dispose()
      atmosphere.material.dispose()
      markerDot.geometry.dispose()
      markerDot.material.dispose()
      markerRing.geometry.dispose()
      markerRing.material.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
      onFocus={() => { hoverRef.current = true }}
      onBlur={() => { hoverRef.current = false }}
      tabIndex={0}
      aria-label="كرة أرضية تقترب من المدينة المنورة عند التمرير"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor: 'zoom-in',
        outline: 'none',
      }}
    />
  )
}
