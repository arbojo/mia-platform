'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

const atmosphereMap: Record<string, string> = {
  '/dashboard': 'home',
  '/dashboard/conversations': 'conversations',
  '/dashboard/knowledge': 'memory',
  '/dashboard/knowledge-studio': 'heuristic',
  '/dashboard/laboratorio': 'lab',
  '/dashboard/assistants': 'council',
  '/dashboard/connections': 'conversations',
  '/dashboard/onboarding': 'home',
}

function getAtmosphere(pathname: string): string {
  const exact = atmosphereMap[pathname]
  if (exact) return exact
  for (const [prefix, atmosphere] of Object.entries(atmosphereMap)) {
    if (pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return atmosphere
    }
  }
  return 'home'
}

const atmosphereLabels: Record<string, string> = {
  home: 'Centro de Mando',
  conversations: 'Conversaciones',
  memory: 'Memoria',
  heuristic: 'Pensamiento',
  lab: 'Laboratorio',
  council: 'Consejo',
}

export function AtmosphereProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [displayAtmosphere, setDisplayAtmosphere] = useState(getAtmosphere(pathname))
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const prevPathname = useRef(pathname)

  const currentAtmosphere = getAtmosphere(pathname)

  useEffect(() => {
    if (pathname === prevPathname.current) return
    const prevAtmosphere = getAtmosphere(prevPathname.current)
    if (prevAtmosphere === currentAtmosphere) {
      prevPathname.current = pathname
      return
    }
    prevPathname.current = pathname
    setTransitionPhase('leaving')
    const t1 = setTimeout(() => {
      setDisplayAtmosphere(currentAtmosphere)
      setTransitionPhase('entering')
      const t2 = setTimeout(() => {
        setTransitionPhase('idle')
      }, 350)
      return () => clearTimeout(t2)
    }, 250)
    return () => clearTimeout(t1)
  }, [pathname, currentAtmosphere])

  return (
    <div
      data-atmosphere={displayAtmosphere}
      className="relative min-h-screen"
      style={{
        transition: transitionPhase === 'idle'
          ? 'background-color 0.6s ease, background-image 0.6s ease'
          : 'none',
      }}
    >
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          background: 'var(--atmosphere-gradient)',
          opacity: transitionPhase === 'leaving' ? 1 : transitionPhase === 'entering' ? 1 : 0,
          transition: transitionPhase === 'leaving'
            ? 'opacity 0.25s ease-in'
            : transitionPhase === 'entering'
            ? 'opacity 0.35s ease-out'
            : 'none',
        }}
      />
      <div
        className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
        style={{
          opacity: transitionPhase === 'leaving' ? 1 : transitionPhase === 'entering' ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        {transitionPhase !== 'idle' && (
            <div
              className="flex flex-col items-center gap-3 transition-opacity"
              style={{
                opacity: transitionPhase === 'entering' ? 0 : 1,
                transition: 'opacity 0.3s ease-out',
                transitionDelay: '0.1s',
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: 'var(--atmosphere-accent)',
                  boxShadow: '0 0 20px var(--atmosphere-glow), 0 0 40px var(--atmosphere-glow)',
                }}
              />
              <span
                className="text-xs font-medium uppercase tracking-[0.15em]"
                style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
              >
                {atmosphereLabels[displayAtmosphere]}
              </span>
            </div>
        )}
      </div>
      <div
        style={{
          opacity: transitionPhase === 'idle' ? 1 : 0,
          transition: transitionPhase === 'entering'
            ? 'opacity 0.4s ease-out'
            : 'opacity 0.15s ease-in',
          transitionDelay: transitionPhase === 'entering' ? '0.1s' : '0s',
        }}
      >
        {children}
      </div>
    </div>
  )
}
