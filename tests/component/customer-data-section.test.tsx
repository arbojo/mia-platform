import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CustomerDataSection } from '@/components/customers/CustomerDataSection'
import { MemoryPanel } from '@/components/customers/MemoryPanel'
import type { CustomerMemory } from '@/lib/ai/customer-memory'

const fullMemory: CustomerMemory = {
  interests: ['gel'],
  objections: [],
  questions: [],
  preferences: [],
  name: 'María López',
  phone: '+52 55 1234 5678',
  email: 'maria@example.com',
  tags: ['VIP', 'recurrente'],
  status: 'converted',
  city: 'CDMX',
  address: 'Av. Reforma 100',
  lastInteraction: '2026-08-20T10:00:00Z',
  summary: 'Cliente frecuente.',
}

describe('CustomerDataSection', () => {
  it('renders persisted contact, delivery and status data', () => {
    render(<CustomerDataSection memory={fullMemory} />)

    expect(screen.getByText(/María López · \+52 55 1234 5678 · maria@example.com/)).toBeTruthy()
    expect(screen.getByText(/CDMX · Av\. Reforma 100/)).toBeTruthy()
    expect(screen.getByText(/converted/)).toBeTruthy()
    expect(screen.getByText('VIP')).toBeTruthy()
    expect(screen.getByText('recurrente')).toBeTruthy()
  })

  it('renders empty placeholder instead of fabricated values when data is missing', () => {
    const minimal: CustomerMemory = {
      interests: [],
      objections: [],
      questions: [],
      preferences: [],
      lastInteraction: null,
      summary: 'Solo resumen.',
    }
    render(<CustomerDataSection memory={minimal} />)

    const placeholders = screen.getAllByText('—')
    expect(placeholders.length).toBe(3)
  })
})

describe('MemoryPanel integration', () => {
  it('shows customer data returned by the memory API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ json: () => Promise.resolve({ memory: fullMemory }) })
      ) as unknown as typeof fetch
    )

    render(<MemoryPanel customerId="c1" assistantId="a1" />)

    await waitFor(() => {
      expect(screen.getByText(/María López/)).toBeTruthy()
    })
    expect(screen.getByText('Memoria del Cliente')).toBeTruthy()

    vi.unstubAllGlobals()
  })
})
