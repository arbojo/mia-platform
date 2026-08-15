import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourProvider, useTour } from '@/components/tour/TourProvider'
import { I18nProvider } from '@/components/dashboard/I18nProvider'
import { getTourText, type TourStep } from '@/components/tour/types'
import { es } from '@/lib/i18n/dictionaries/es'

const pathnameMock = { current: '/dashboard' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => pathnameMock.current,
}))

function Host() {
  const { startForPath } = useTour()
  return (
    <div>
      <button type="button" data-tour="module-chip">
        Chip de módulo
      </button>
      <button type="button" data-tour="theme-toggle">
        Cambiar tema
      </button>
      <button type="button" onClick={() => startForPath(pathnameMock.current)}>
        Iniciar tutorial
      </button>
    </div>
  )
}

function renderTour(pathname = '/dashboard') {
  pathnameMock.current = pathname
  return render(
    <I18nProvider locale="es">
      <TourProvider>
        <Host />
      </TourProvider>
    </I18nProvider>
  )
}

describe('Tour interactivo', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(cb, 0))
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('startForPath abre el tutorial con el primer paso del shell', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Tu navegación')).toBeInTheDocument()
    expect(screen.getByText('Paso 1 de 9')).toBeInTheDocument()
  })

  it('avanza de paso con el botón Siguiente', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Módulo activo')).toBeInTheDocument()
    expect(screen.getByText('Paso 2 de 9')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Modo claro / oscuro')).toBeInTheDocument()
  })

  it('permite regresar con el botón Atrás', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(screen.getByText('Tu navegación')).toBeInTheDocument()
  })

  it('cierra con Escape', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('avanza con la flecha derecha y regresa con la izquierda', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Módulo activo')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Tu navegación')).toBeInTheDocument()
  })

  it('ofrece el tutorial automáticamente la primera vez en una página contextual', () => {
    renderTour('/dashboard')

    expect(screen.getByText('¿Quieres ver cómo funciona?')).toBeInTheDocument()
    expect(localStorage.getItem('mia-tour-seen:/dashboard')).toBeNull()
  })

  it('inicia el tour desde el ofrecimiento automático', () => {
    renderTour('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tutorial' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(localStorage.getItem('mia-tour-seen:/dashboard')).toBe('1')
  })

  it('descarta el ofrecimiento con "No, gracias" y persiste la decisión', () => {
    renderTour('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'No, gracias' }))

    expect(screen.queryByText('¿Quieres ver cómo funciona?')).not.toBeInTheDocument()
    expect(localStorage.getItem('mia-tour-seen:/dashboard')).toBe('1')
  })

  it('no ofrece el tutorial en páginas sin tour contextual', () => {
    renderTour('/dashboard/health')

    expect(screen.queryByText('¿Quieres ver cómo funciona?')).not.toBeInTheDocument()
  })

  it('getTourText resuelve claves anidadas del diccionario', () => {
    expect(getTourText(es, 'shell.nav.title')).toBe('Tu navegación')
    expect(getTourText(es, 'catalog.grid.desc')).toContain('Cada tarjeta es un producto')
    expect(getTourText(es, 'inexistente.ruta')).toBe('inexistente.ruta')
  })

  it('mantiene el tipo TourStep con target y claves i18n', () => {
    const step: TourStep = {
      target: '[data-tour="signals-bell"]',
      titleKey: 'shell.signals.title',
      descKey: 'shell.signals.desc',
    }
    expect(step.target).toBe('[data-tour="signals-bell"]')
  })
})
