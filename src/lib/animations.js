import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * يُشغَّل مرة واحدة بعد mount الصفحة الرئيسية
 * — نفس الـ GSAP المكتوب في الـ HTML الأصلي بالضبط
 */
export function useHomeAnimations() {
  useEffect(() => {
    // Hero reveal (staggered)
    gsap.to('.hero .reveal', {
      opacity: 1, y: 0, duration: 1,
      ease: 'power3.out', stagger: 0.15, delay: 0.2,
    })

    // Section reveals on scroll
    gsap.utils.toArray('.section .reveal').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' } }
      )
    })

    gsap.utils.toArray('.section .reveal-l').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 80%' } }
      )
    })

    gsap.utils.toArray('.section .reveal-r').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, x: 40 },
        { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 80%' } }
      )
    })

    // Pillars staggered
    gsap.fromTo('.pillars-grid .pillar',
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'back.out(1.2)', stagger: 0.15,
        scrollTrigger: { trigger: '.pillars-grid', start: 'top 80%' } }
    )

    // Who cards staggered
    gsap.fromTo('.who-grid .who-card',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1,
        scrollTrigger: { trigger: '.who-grid', start: 'top 80%' } }
    )

    // Timeline line draw on scroll
    ScrollTrigger.create({
      trigger: '.timeline-wrap',
      start: 'top 70%', end: 'bottom 60%', scrub: true,
      onUpdate(self) {
        const ln = document.querySelector('.timeline-line')
        if (ln) ln.style.setProperty('--p', self.progress)
      },
    })

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])
}

/**
 * Register page — fade-up entrance
 */
export function useRegisterAnimations() {
  useEffect(() => {
    gsap.to('.fade-up', {
      opacity: 1, y: 0, duration: 1,
      ease: 'power3.out', stagger: 0.12, delay: 0.1,
    })
  }, [])
}

export { gsap }
