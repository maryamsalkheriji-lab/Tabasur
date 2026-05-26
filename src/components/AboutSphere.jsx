import { useEffect, useRef } from 'react'
import { THREE, BRAND } from '../lib/three-setup'

export default function AboutSphere() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 4.2

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 36, 24),
      new THREE.MeshBasicMaterial({ color: BRAND.green, wireframe: true, transparent: true, opacity: 0.65 })
    )
    scene.add(sphere)

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 24, 16),
      new THREE.MeshBasicMaterial({ color: BRAND.coral, wireframe: true, transparent: true, opacity: 0.40 })
    )
    scene.add(inner)

    const orbCount = 80
    const opos = new Float32Array(orbCount * 3)
    const ocol = new Float32Array(orbCount * 3)
    for (let i = 0; i < orbCount; i++) {
      const u = Math.random() * Math.PI * 2
      const v = Math.acos(2 * Math.random() - 1)
      const r = 1.9 + Math.random() * 0.15
      opos[i*3+0] = r * Math.sin(v) * Math.cos(u)
      opos[i*3+1] = r * Math.sin(v) * Math.sin(u)
      opos[i*3+2] = r * Math.cos(v)
      const c = (i % 6 === 0) ? BRAND.mauve : (i % 2 === 0 ? BRAND.green : BRAND.coral)
      ocol[i*3+0] = c.r; ocol[i*3+1] = c.g; ocol[i*3+2] = c.b
    }
    const og = new THREE.BufferGeometry()
    og.setAttribute('position', new THREE.BufferAttribute(opos, 3))
    og.setAttribute('color',    new THREE.BufferAttribute(ocol, 3))
    const om = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 1, depthWrite: false })
    const orbPoints = new THREE.Points(og, om)
    scene.add(orbPoints)

    function resize() {
      const r = canvas.getBoundingClientRect()
      renderer.setSize(r.width, r.height, false)
      camera.aspect = r.width / Math.max(1, r.height)
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)
    resize()

    let rafId
    function tick(t) {
      sphere.rotation.y = t * 0.00018
      sphere.rotation.x = Math.sin(t * 0.0002) * 0.3
      inner.rotation.y  = -t * 0.00026
      inner.rotation.z  =  t * 0.00012
      orbPoints.rotation.y = t * 0.00012
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
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    />
  )
}
