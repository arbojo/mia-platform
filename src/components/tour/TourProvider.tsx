'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { SHELL_TOUR, getPageTour, hasContextualTour } from '@/lib/tour/tours'
import { tourSeenKey, type TourDef } from '@/components/tour/types'
import { TourOverlay } from '@/components/tour/TourOverlay'

interface TourContextValue {
  startForPath: (pathname: string) => void
  next: () => void
  prev: () => void
  close: () => void
  dismissOffer: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

function subscribeNever() {
  return () => {}
}

function readOfferFor(pathname: string | null): string | null {
  if (!pathname || !hasContextualTour(pathname)) return null
  let seen = false
  try {
    seen = localStorage.getItem(tourSeenKey(pathname)) === '1'
  } catch {
    seen = false
  }
  return seen ? null : pathname
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [tour, setTour] = useState<TourDef | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [prevPath, setPrevPath] = useState(pathname)
  const [offerFor, setOfferFor] = useState<string | null>(() => readOfferFor(pathname))
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false)

  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setOfferFor(readOfferFor(pathname))
    setTour(null)
    setStepIndex(0)
  }

  const begin = useCallback((def: TourDef, markPath?: string) => {
    setTour(def)
    setStepIndex(0)
    setOfferFor(null)
    if (markPath) {
      try {
        localStorage.setItem(tourSeenKey(markPath), '1')
      } catch {
        // Sin localStorage (SSR/privacidad) el tour funciona igual; solo se repite el ofrecimiento.
      }
    }
  }, [])

  const startForPath = useCallback(
    (nextPath: string) => {
      const pageTour = getPageTour(nextPath)
      if (!pageTour) {
        begin(SHELL_TOUR, nextPath)
        return
      }
      const steps =
        nextPath === '/dashboard'
          ? [...SHELL_TOUR.steps, ...pageTour.steps]
          : pageTour.steps
      begin({ key: `${pageTour.key}-tour`, steps }, nextPath)
    },
    [begin]
  )

  const close = useCallback(() => {
    setTour(null)
    setStepIndex(0)
  }, [])

  const next = useCallback(() => {
    if (!tour) return
    if (stepIndex >= tour.steps.length - 1) {
      close()
      return
    }
    setStepIndex(stepIndex + 1)
  }, [tour, stepIndex, close])

  const prev = useCallback(() => {
    if (!tour) return
    setStepIndex((index) => Math.max(0, index - 1))
  }, [tour])

  const dismissOffer = useCallback(() => {
    if (!pathname) return
    try {
      localStorage.setItem(tourSeenKey(pathname), '1')
    } catch {
      // Sin localStorage el ofrecimiento puede repetirse; no es un fallo.
    }
    setOfferFor(null)
  }, [pathname])

  const value = useMemo<TourContextValue>(
    () => ({ startForPath, next, prev, close, dismissOffer }),
    [startForPath, next, prev, close, dismissOffer]
  )

  return (
    <TourContext.Provider value={value}>
      {children}
      {isClient && offerFor && pathname
        ? createPortal(
            <div
              className="fixed bottom-24 right-5 z-[950] w-72"
              style={{
                padding: 16,
                borderRadius: 'var(--mod-radius-md)',
                backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 92%, transparent)',
                border: '1px solid var(--atmosphere-border)',
                boxShadow:
                  '0 0 0 1px var(--module-accent-border), 0 8px 32px rgba(0,0,0,0.35), 0 0 24px var(--module-glow-soft)',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                animation: 'fade-lift-in var(--duration-fast, 150ms) var(--ease-premium)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                {t.tour.offerTitle}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {t.tour.offerDesc}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startForPath(pathname)}
                  className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                  style={{ backgroundColor: 'var(--atmosphere-accent)' }}
                >
                  {t.tour.offerStart}
                </button>
                <button
                  type="button"
                  onClick={dismissOffer}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  {t.tour.offerDismiss}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
      {isClient && tour ? (
        <TourOverlay
          tour={tour}
          stepIndex={stepIndex}
          onNext={next}
          onPrev={prev}
          onClose={close}
        />
      ) : null}
    </TourContext.Provider>
  )
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error('useTour debe usarse dentro de <TourProvider>')
  }
  return ctx
}
