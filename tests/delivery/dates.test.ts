import { describe, it, expect } from 'vitest'
import {
  getNextDeliveryDay,
  formatDeliveryDay,
  formatTime,
  formatDeliveryDaysList,
  buildDeliveryPromptSection,
  type DeliverySchedule,
} from '@/lib/delivery/dates'

const D = (year: number, month: number, day: number): Date => new Date(year, month - 1, day)

describe('getNextDeliveryDay', () => {
  it('devuelve el siguiente día programado estrictamente posterior', () => {
    expect(getNextDeliveryDay({ days: [2, 4, 6], asOf: D(2026, 2, 5) })).toEqual(D(2026, 2, 7))
    expect(getNextDeliveryDay({ days: [2, 4, 6], asOf: D(2026, 2, 4) })).toEqual(D(2026, 2, 5))
  })

  it('salta los días sin entrega y cruza de semana', () => {
    expect(getNextDeliveryDay({ days: [2, 4, 6], asOf: D(2026, 2, 7) })).toEqual(D(2026, 2, 10))
    expect(getNextDeliveryDay({ days: [1, 3, 5], asOf: D(2026, 2, 6) })).toEqual(D(2026, 2, 9))
  })

  it('nunca entrega el mismo día aunque sea día programado', () => {
    expect(getNextDeliveryDay({ days: [4], asOf: D(2026, 2, 5) })).toEqual(D(2026, 2, 12))
  })

  it('entrega diaria = siempre el día siguiente', () => {
    expect(
      getNextDeliveryDay({ days: [0, 1, 2, 3, 4, 5, 6], asOf: D(2026, 2, 1) })
    ).toEqual(D(2026, 2, 2))
  })

  it('cruza el fin de mes', () => {
    expect(getNextDeliveryDay({ days: [0], asOf: D(2026, 2, 1) })).toEqual(D(2026, 2, 8))
    expect(getNextDeliveryDay({ days: [2, 4, 6], asOf: D(2026, 2, 27) })).toEqual(D(2026, 2, 28))
  })

  it('devuelve null sin días válidos', () => {
    expect(getNextDeliveryDay({ days: [] })).toBeNull()
    expect(getNextDeliveryDay({ days: [9, -1, 7] })).toBeNull()
    expect(getNextDeliveryDay({ days: [0, 1, 2, 3, 4, 5, 6, 8] })).not.toBeNull()
  })
})

describe('formatDeliveryDay', () => {
  it('formatea en español con nombre de día', () => {
    expect(formatDeliveryDay(D(2026, 2, 7))).toBe('sábado 7 de febrero')
    expect(formatDeliveryDay(D(2026, 2, 2))).toBe('lunes 2 de febrero')
  })
})

describe('formatTime', () => {
  it('quita el cero inicial de la hora', () => {
    expect(formatTime('09:00')).toBe('9:00')
    expect(formatTime('19:00')).toBe('19:00')
  })
})

describe('formatDeliveryDaysList', () => {
  it('ordena y une en español', () => {
    expect(formatDeliveryDaysList([2, 4, 6])).toBe('martes, jueves y sábado')
    expect(formatDeliveryDaysList([1, 3, 5])).toBe('lunes, miércoles y viernes')
    expect(formatDeliveryDaysList([6, 2, 4])).toBe('martes, jueves y sábado')
  })

  it('resuelve casos límite', () => {
    expect(formatDeliveryDaysList([0, 1, 2, 3, 4, 5, 6])).toBe('todos los días')
    expect(formatDeliveryDaysList([1])).toBe('lunes')
    expect(formatDeliveryDaysList([])).toBe('')
    expect(formatDeliveryDaysList([2, 2, 4])).toBe('martes y jueves')
  })
})

describe('buildDeliveryPromptSection', () => {
  const schedules: DeliverySchedule[] = [
    { city: 'León', delivery_days: [0, 1, 2, 3, 4, 5, 6], delivery_window_start: '09:00', delivery_window_end: '19:00' },
    { city: 'Lagos de Moreno', delivery_days: [2, 4, 6], delivery_window_start: '09:00', delivery_window_end: '19:00' },
  ]

  it('devuelve vacío sin schedules', () => {
    expect(buildDeliveryPromptSection({ schedules: [], now: D(2026, 2, 5) })).toBe('')
  })

  it('inyecta fechas calculadas por ciudad', () => {
    const out = buildDeliveryPromptSection({ schedules, now: D(2026, 2, 5) })
    expect(out).toBeTruthy()
    expect(out).toContain('León')
    expect(out).toContain('sábado 7 de febrero')
    expect(out).not.toContain('domingo 8 de febrero')
  })

  it('resalta la ciudad del cliente actual', () => {
    const out = buildDeliveryPromptSection({ schedules, customerCity: 'León', now: D(2026, 2, 5) })
    expect(out).toContain('El cliente actual está en León')
    expect(out).toContain('viernes 6 de febrero')
  })

  it('hace match de ciudad case-insensitive y con acentos', () => {
    const out = buildDeliveryPromptSection({ schedules, customerCity: '  lEón ', now: D(2026, 2, 5) })
    expect(out).toContain('El cliente actual está en León')
  })

  it('ignora city sin horario configurado', () => {
    const out = buildDeliveryPromptSection({ schedules, customerCity: 'Pueblo Fantasma', now: D(2026, 2, 5) })
    expect(out).not.toContain('Pueblo Fantasma')
    expect(out).toContain('Días de entrega')
  })
})