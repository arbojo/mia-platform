import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityRail } from '@/components/dashboard/ActivityRail'
import { I18nProvider } from '@/components/dashboard/I18nProvider'
import { ContextMenuProvider } from '@/components/ui/context-menu'
import { TourProvider } from '@/components/tour/TourProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}))

function renderRail() {
  return render(
    <I18nProvider locale="es">
      <ContextMenuProvider>
        <TourProvider>
          <ActivityRail />
        </TourProvider>
      </ContextMenuProvider>
    </I18nProvider>
  )
}

describe('ActivityRail sidebar', () => {
  it('renderiza todas las opciones de navegación siempre visibles sin hover', () => {
    renderRail()

    const expectedLabels = [
      'Centro de Mando',
      'Relaciones',
      'Memoria',
      'Pensamiento',
      'Catálogo',
      'Laboratorio',
      'Delivery',
      'Inventario',
      'Conexiones',
      'Concilio',
      'Salud',
      'Accesibilidad',
    ]

    for (const label of expectedLabels) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('incluye el grupo Configuración en la lista principal con enlaces estáticos', () => {
    renderRail()

    expect(screen.getByText('Configuración')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Conexiones' })).toHaveAttribute(
      'href',
      '/dashboard/connections'
    )
    expect(screen.getByRole('link', { name: 'Concilio' })).toHaveAttribute(
      'href',
      '/dashboard/assistants'
    )
    expect(screen.getByRole('link', { name: 'Salud' })).toHaveAttribute(
      'href',
      '/dashboard/health'
    )
    expect(screen.getByRole('link', { name: 'Accesibilidad' })).toHaveAttribute(
      'href',
      '/dashboard/accessibility'
    )
  })

  it('ya no existe el botón flotante de Configuración al pie del sidebar', () => {
    renderRail()

    expect(screen.queryByTitle('Configuración')).not.toBeInTheDocument()
  })

  it('mantiene el sidebar siempre expandido con ancho fijo', () => {
    renderRail()

    const aside = screen.getByRole('complementary', { name: 'Navegación' })
    expect(aside.getAttribute('style')).toContain('width: 260px')
  })

  it('muestra el botón Tutorial justo después de Accesibilidad en el nav', () => {
    renderRail()

    const accessibility = screen.getByRole('link', { name: 'Accesibilidad' })
    const tutorial = screen.getByRole('button', { name: 'Tutorial' })
    expect(accessibility.compareDocumentPosition(tutorial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
