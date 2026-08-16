import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import { GlassLoader } from '@/components/ui/glass-loader'

let currentPathname = '/dashboard'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

const MIN_DISPLAY_MS = 450

function overlay(container: HTMLElement) {
  return container.querySelector('.glass-loader-overlay')
}

describe('GlassLoader', () => {
  beforeEach(() => {
    currentPathname = '/dashboard'
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    document.body.innerHTML = ''
  })

  it('renderiza el overlay inactivo al inicio (sin activar, aria-hidden)', () => {
    const { container } = render(<GlassLoader />)

    expect(overlay(container)).not.toBeNull()
    expect(overlay(container)).not.toHaveClass('active')
    expect(overlay(container)).toHaveAttribute('aria-hidden', 'true')
  })

  it('renderiza el spinner glow con role=status (oculto para AT cuando inactivo)', () => {
    const { container } = render(<GlassLoader />)

    const spinner = container.querySelector('.mia-glow-spinner')
    expect(spinner).not.toBeNull()
    expect(spinner?.closest('[role="status"]')).not.toBeNull()
  })

  it('se activa al navegar entre vistas (cambio de pathname) y se oculta tras la duración mínima', () => {
    const { container, rerender } = render(<GlassLoader />)

    currentPathname = '/dashboard/knowledge'
    act(() => {
      rerender(<GlassLoader />)
    })

    expect(overlay(container)).toHaveClass('active')
    expect(overlay(container)).toHaveAttribute('aria-hidden', 'false')

    act(() => {
      vi.advanceTimersByTime(MIN_DISPLAY_MS + 10)
    })

    expect(overlay(container)).not.toHaveClass('active')
  })

  it('no se activa cuando solo cambian los searchParams (mismo pathname)', () => {
    const { container, rerender } = render(<GlassLoader />)

    currentPathname = '/dashboard'
    act(() => {
      rerender(<GlassLoader />)
    })

    expect(overlay(container)).not.toHaveClass('active')
  })

  it('se activa con un click en un anchor interno a otra vista', () => {
    const { container } = render(<GlassLoader />)
    document.body.innerHTML = '<a href="/dashboard/catalog">Catálogo</a>'

    act(() => {
      fireEvent.click(document.querySelector('a') as HTMLAnchorElement)
    })

    expect(overlay(container)).toHaveClass('active')
  })

  it('no se activa con clicks en anchors internos a la misma vista o externos', () => {
    const { container } = render(<GlassLoader />)
    document.body.innerHTML =
      '<a href="/dashboard" id="same">Mismo</a><a href="https://external.com" id="ext">Externo</a>'

    act(() => {
      fireEvent.click(document.getElementById('same') as HTMLAnchorElement)
    })
    expect(overlay(container)).not.toHaveClass('active')

    act(() => {
      fireEvent.click(document.getElementById('ext') as HTMLAnchorElement)
    })
    expect(overlay(container)).not.toHaveClass('active')
  })

  it('se activa con popstate (back/forward) y se oculta tras la duración mínima', () => {
    const { container } = render(<GlassLoader />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(overlay(container)).toHaveClass('active')

    act(() => {
      vi.advanceTimersByTime(MIN_DISPLAY_MS + 10)
    })

    expect(overlay(container)).not.toHaveClass('active')
  })

  it('no se activa con clicks con modificador (cmd/ctrl + click)', () => {
    const { container } = render(<GlassLoader />)
    document.body.innerHTML = '<a href="/dashboard/catalog">Catálogo</a>'

    act(() => {
      fireEvent.click(document.querySelector('a') as HTMLAnchorElement, {
        ctrlKey: true,
      })
    })

    expect(overlay(container)).not.toHaveClass('active')
  })
})
