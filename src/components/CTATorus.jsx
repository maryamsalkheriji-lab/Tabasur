import { useEffect, useRef } from 'react'
import { THREE, BRAND } from '../lib/three-setup'

export default function CTATorus() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 7

    const t1 = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.55, 24, 120),
      new THREE.MeshBasicMaterial({ color: BRAND.green, wireframe: true, transparent: true, opacity: 0.55 })
    )
    scene.add(t1)

    const t2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.25, 16, 80),
      new THREE.MeshBasicMaterial({ color: BRAND.coral, wireframe: true, transparent: true, opacity: 0.35 })
    )
    scene.add(t2)

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
      t1.rotation.x = t * 0.00018
      t1.rotation.y = t * 0.00012
      t2.rotation.x = -t * 0.00022
      t2.rotation.y =  t * 0.0002
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
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', opacity: 0.65, width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  )
}
