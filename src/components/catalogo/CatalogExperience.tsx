'use client'

import { useEffect, useRef, useState } from 'react'
import { catalogProducts } from '@/lib/catalogo/products'
import { HeroScene } from './HeroScene'
import { ProductScene } from './ProductScene'
import { ClosingScene } from './ClosingScene'
import { SceneRail } from './SceneRail'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function CatalogExperience() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)
  const sceneRefs = useRef<(HTMLElement | null)[]>([])
  const closingRef = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduceMotion.matches) return

    let rafId = 0
    let lastActive = -1
    let closingTop = 0
    let sceneTops: number[] = []
    let sceneTracks: number[] = []

    const viewportH = () => window.innerHeight

    const measure = () => {
      closingTop = closingRef.current?.offsetTop ?? 0
      sceneTops = sceneRefs.current.map((el) => el?.offsetTop ?? 0)
      sceneTracks = sceneRefs.current.map((el) => (el ? el.offsetHeight - viewportH() : 0))
    }

    const setP = (el: HTMLElement | null, value: number) => {
      el?.style.setProperty('--p', value.toFixed(4))
    }

    const tick = () => {
      const y = window.scrollY

      const heroP = clamp(y / viewportH(), 0, 1)
      setP(heroRef.current, heroP)

      for (let i = 0; i < sceneRefs.current.length; i += 1) {
        const track = sceneTracks[i] > 0 ? sceneTracks[i] : 1
        setP(sceneRefs.current[i], clamp((y - sceneTops[i]) / track, 0, 1))
      }

      const closingP = clamp((y - closingTop) / viewportH(), 0, 1)
      setP(closingRef.current, closingP)

      let current = 0
      for (let i = 0; i < sceneRefs.current.length; i += 1) {
        if (y >= sceneTops[i] - viewportH() * 0.2) current = i + 1
        else break
      }
      if (y >= closingTop - viewportH() * 0.6) current = sceneRefs.current.length + 1
      if (current !== lastActive) {
        lastActive = current
        setActive(current)
      }

      root.style.setProperty('--scroll', clamp(y / Math.max(1, document.documentElement.scrollHeight - viewportH()), 0, 1).toFixed(4))

      rafId = requestAnimationFrame(tick)
    }

    measure()
    rafId = requestAnimationFrame(tick)

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(measure, 120)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const scrollToIndex = (index: number) => {
    const target =
      index === 0
        ? document.getElementById('catalogo-inicio')
        : index <= catalogProducts.length
          ? document.getElementById(`catalogo-${catalogProducts[index - 1].slug}`)
          : document.getElementById('catalogo-contacto')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const registerScene = (el: HTMLElement | null, index: number) => {
    sceneRefs.current[index] = el
  }

  return (
    <div ref={rootRef} className="catalogo-root">
      <div className="catalogo-scrollbar" aria-hidden="true" />

      <HeroScene ref={heroRef} />

      {catalogProducts.map((product, index) => (
        <ProductScene
          key={product.slug}
          product={product}
          index={index}
          registerScene={registerScene}
        />
      ))}

      <ClosingScene ref={closingRef} />

      <SceneRail active={active} onSelect={scrollToIndex} />
    </div>
  )
}