'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { getTourText, type TourDef } from '@/components/tour/types'

interface TourOverlayProps {
  tour: TourDef
  stepIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

interface Rect {
  left: number
  top: number
  width: number
  height: number
  bottom: number
}

const TOOLTIP_PAD = 12
const TOOLTIP_OFFSET = 14
const SPOTLIGHT_PADDING = 6

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function TourOverlay({ tour, stepIndex, onNext, onPrev, onClose }: TourOverlayProps) {
  const { t } = useI18n()
  const step = tour.steps[stepIndex]
  const isLast = stepIndex >= tour.steps.length - 1
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)

  const title = getTourText(t, step.titleKey)
  const desc = getTourText(t, step.descKey)
  const maskId = useId()

  const measure = useCallback(() => {
    const el = document.querySelector(step.target)
    if (!el) {
      setTargetRect(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setTargetRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
    })
  }, [step.target])

  useLayoutEffect(() => {
    const el = document.querySelector(step.target)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el setState ocurre en handlers de scroll/resize (patrón de medición canónico)
    measure()
    const settleA = window.setTimeout(measure, 500)
    const settleB = window.setTimeout(measure, 1500)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(settleA)
      window.clearTimeout(settleB)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, measure])

  useLayoutEffect(() => {
    const tip = tooltipRef.current
    if (!tip) return
    const tipWidth = tip.offsetWidth
    const tipHeight = tip.offsetHeight
    const rect = targetRect
    if (!rect) {
      setTooltipPos({
        x: clamp(window.innerWidth / 2 - tipWidth / 2, TOOLTIP_PAD, window.innerWidth - tipWidth - TOOLTIP_PAD),
        y: clamp(window.innerHeight / 2 - tipHeight / 2, TOOLTIP_PAD, window.innerHeight - tipHeight - TOOLTIP_PAD),
      })
      return
    }
    let x = rect.left + rect.width / 2 - tipWidth / 2
    x = clamp(x, TOOLTIP_PAD, window.innerWidth - tipWidth - TOOLTIP_PAD)
    let y = rect.bottom + TOOLTIP_OFFSET
    if (y + tipHeight > window.innerHeight - TOOLTIP_PAD) {
      y = Math.max(TOOLTIP_PAD, rect.top - tipHeight - TOOLTIP_OFFSET)
    }
    setTooltipPos({ x, y })
  }, [targetRect, stepIndex])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'ArrowLeft') onPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, onPrev, onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.tour.dialogLabel}
      className="fixed inset-0 z-[1000]"
    >
      {targetRect ? (
        <div
          className="fixed inset-0"
          onClick={onClose}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg width="100%" height="100%">
            <defs>
              <mask id={maskId}>
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - SPOTLIGHT_PADDING}
                  y={targetRect.top - SPOTLIGHT_PADDING}
                  width={targetRect.width + SPOTLIGHT_PADDING * 2}
                  height={targetRect.height + SPOTLIGHT_PADDING * 2}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.55)" mask={`url(#${maskId})`} />
          </svg>
        </div>
      ) : (
        <div
          className="fixed inset-0"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onClick={onClose}
        />
      )}

      {targetRect && (
        <div
          className="pointer-events-none fixed"
          style={{
            left: targetRect.left - SPOTLIGHT_PADDING,
            top: targetRect.top - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: 'var(--mod-radius-md)',
            border: '3px solid var(--module-accent)',
            boxShadow: '0 0 32px var(--module-glow-soft)',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="fixed"
        style={{
          left: tooltipPos.x,
          top: tooltipPos.y,
          width: '20rem',
          maxWidth: 'calc(100vw - 24px)',
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
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-0.5 transition-colors duration-150"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
            aria-label={t.tour.closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {desc}
        </p>

        <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--module-accent)' }}>
          {t.tour.step(stepIndex + 1, tour.steps.length)}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium transition-colors duration-150"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {t.tour.skip}
          </button>
          <div className="flex-1" />
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150"
              style={{ backgroundColor: 'var(--elevation-2)', color: 'var(--atmosphere-text)' }}
            >
              {t.tour.back}
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            style={{ backgroundColor: 'var(--atmosphere-accent)' }}
          >
            {isLast ? t.tour.finish : t.tour.next}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
