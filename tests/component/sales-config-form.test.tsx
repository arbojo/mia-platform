import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalesConfigForm } from '@/components/sales/SalesConfigForm'
import { I18nProvider } from '@/components/dashboard/I18nProvider'

type FetchCall = { url: string; method?: string; body?: string }

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as never
})

const loadedServerConfig = {
  ask_address: true,
  ask_phone: true,
  confirmation_message: 'Confirmado {order_number}',
  allow_cancellation: true,
  cancellation_window_hours: 24,
  cancellation_message: 'Cancelado',
  retention_discount_percent: 15,
  retention_discount_message: 'Retención {discount_percent}% para {customer_name}',
}

function renderForm() {
  return render(
    <I18nProvider locale="es">
      <SalesConfigForm />
    </I18nProvider>,
  )
}

describe('SalesConfigForm — policy de retención (T1-1)', () => {
  it('mapea los campos de retención desde la configuración persistida', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ config: loadedServerConfig }) })
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Descuento ofrecido (%)')).toHaveValue(15)
    })
    expect(screen.getByDisplayValue('Retención {discount_percent}% para {customer_name}')).toBeTruthy()
  })

  it('renders la vista previa sustituyendo discount_percent y customer_name', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ config: loadedServerConfig }) })
    renderForm()

    await waitFor(() => {
      expect(screen.getByText(/Retención 15% para Juan/)).toBeTruthy()
    })
  })

  it('clampea el percent dentro del rango 5..20 en la UI', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ config: loadedServerConfig }) })
    renderForm()

    const input = await screen.findByLabelText('Descuento ofrecido (%)')
    fireEvent.change(input, { target: { value: '99' } })
    expect(input).toHaveValue(20)
    fireEvent.change(input, { target: { value: '1' } })
    expect(input).toHaveValue(5)
  })

  it('persiste los campos de retención al guardar', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: loadedServerConfig }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    renderForm()

    const input = await screen.findByLabelText('Descuento ofrecido (%)')
    fireEvent.change(input, { target: { value: '18' } })

    fireEvent.click(screen.getByText('Guardar configuración'))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) => (c[1] as { method?: string } | undefined)?.method === 'POST',
      ) as [string, FetchCall] | undefined
      expect(postCall).toBeTruthy()
      const body = JSON.parse(postCall![1].body!)
      expect(body.retention_discount_percent).toBe(18)
      expect(body.retention_discount_message).toBe(
        'Retención {discount_percent}% para {customer_name}',
      )
      expect(body.allow_cancellation).toBe(true)
    })
  })
})