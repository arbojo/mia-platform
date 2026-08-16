'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { MiaGlowSpinner } from '@/components/ui/mia-glow-spinner'
import { cn } from '@/lib/utils'

const MIN_DISPLAY_MS = 450

function isInternalNavigation(href: string, currentPathname: string): boolean {
  if (!href.startsWith('/') || href.startsWith('#')) return false
  const target = href.split(/[?#]/)[0]
  return target !== currentPathname
}

function shouldIntercept(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const target = event.target as Element | null
  const anchor = target?.closest('a[href]')
  if (!anchor) return false
  return (anchor as HTMLAnchorElement).target !== '_blank'
}

export function GlassLoader() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  const activeRef = useRef(false)
  const pathnameRef = useRef(pathname)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function show() {
      if (activeRef.current) return
      activeRef.current = true
      setActive(true)
    }

    function hide() {
      if (!activeRef.current) return
      activeRef.current = false
      setActive(false)
    }

    function scheduleHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(hide, MIN_DISPLAY_MS)
    }

    function onPopState() {
      show()
      scheduleHide()
    }

    function onClick(event: MouseEvent) {
      if (!shouldIntercept(event)) return
      const anchor = (event.target as Element).closest('a[href]') as HTMLAnchorElement
      const href = anchor.getAttribute('href') ?? ''
      if (isInternalNavigation(href, pathnameRef.current)) {
        show()
      }
    }

    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClick, true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const previousPathname = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname

    if (pathname === previousPathname.current) return
    previousPathname.current = pathname

    activeRef.current = true
    setActive(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      activeRef.current = false
      setActive(false)
    }, MIN_DISPLAY_MS)
  }, [pathname])

  return (
    <div className={cn('glass-loader-overlay', active && 'active')} aria-hidden={!active}>
      <MiaGlowSpinner />
    </div>
  )
}
