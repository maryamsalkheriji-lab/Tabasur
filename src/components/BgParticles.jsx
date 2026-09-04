import { useEffect, useRef } from 'react'
import { THREE, BRAND } from '../lib/three-setup'

export default function BgParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    camera.position.z = 60

    const COUNT = 180
    const positions = new Float32Array(COUNT * 3)
    const colors    = new Float32Array(COUNT * 3)
    const speeds    = new Float32Array(COUNT)

    function pickColor() {
      const r = Math.random()
      if (r < 0.60) return BRAND.green
      if (r < 0.90) return BRAND.coral
      return BRAND.mauve
    }

    for (let i = 0; i < COUNT; i++) {
      positions[i*3+0] = (Math.random() - 0.5) * 150
      positions[i*3+1] = (Math.random() - 0.5) * 100
      positions[i*3+2] = (Math.random() - 0.5) * 80
      const c = pickColor()
      colors[i*3+0] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b
      speeds[i] = 0.012 + Math.random() * 0.035
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({ size: 0.72, vertexColors: true, transparent: true, opacity: 0.72, sizeAttenuation: true, depthWrite: false })
    const points = new THREE.Points(geom, mat)
    scene.add(points)

    function resize() {
      const w = window.innerWidth, h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)
    resize()

    const arr = geom.attributes.position.array
    let rafId
    function tick(t) {
      for (let i = 0; i < COUNT; i++) {
        arr[i*3+1] += speeds[i] * 0.3
        arr[i*3+0] += Math.sin(t * 0.0005 + i) * 0.008
        if (arr[i*3+1] > 55) arr[i*3+1] = -55
      }
      geom.attributes.position.needsUpdate = true
      points.rotation.y = Math.sin(t * 0.00012) * 0.06
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.55 }}
      aria-hidden="true"
    />
  )
}
