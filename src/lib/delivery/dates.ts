import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface DeliverySchedule {
  city: string
  delivery_days: number[]
  delivery_window_start: string
  delivery_window_end: string
}

export const WEEKDAY_NAMES_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

/**
 * Próximo día de entrega programado ESTRICTAMENTE después de `asOf`.
 * Regla de negocio: nunca se entrega el mismo día — siempre el siguiente
 * día programado de la ciudad. Devuelve null si no hay días válidos.
 */
export function getNextDeliveryDay(params: {
  days: number[]
  asOf?: Date
}): Date | null {
  const allowed = new Set(
    params.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  )
  if (allowed.size === 0) return null

  const cursor = new Date(params.asOf ?? new Date())
  cursor.setDate(cursor.getDate() + 1)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < 14; i += 1) {
    if (allowed.has(cursor.getDay())) return new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

/** "5 de febrero 2026" → "jueves 5 de febrero" */
export function formatDeliveryDay(date: Date): string {
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

/** "09:00" → "9:00", "19:00" → "19:00" */
export function formatTime(value: string): string {
  const hour = value.slice(0, 2)
  return `${hour.startsWith('0') ? hour.slice(1) : hour}${value.slice(2)}`
}

/** [1,3,5] → "lunes, miércoles y viernes"; días completos → "todos los días" */
export function formatDeliveryDaysList(days: number[]): string {
  const names = [...new Set(days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAMES_ES[d])
  if (names.length === 0) return ''
  if (names.length === 7) return 'todos los días'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase()
}

function findSchedule(
  schedules: DeliverySchedule[],
  city: string
): DeliverySchedule | null {
  const target = normalizeCity(city)
  return schedules.find((s) => normalizeCity(s.city) === target) ?? null
}

export interface DeliveryPromptSectionOptions {
  schedules: DeliverySchedule[]
  customerCity?: string | null
  now?: Date
}

/**
 * Sección determinista de días de entrega para el prompt. Devuelve '' cuando
 * no hay horarios configurados (comportamiento previo intacto).
 */
export function buildDeliveryPromptSection(
  options: DeliveryPromptSectionOptions
): string {
  const { schedules } = options
  const now = options.now ?? new Date()

  const valid = schedules
    .map((schedule) => ({
      schedule,
      nextDelivery: getNextDeliveryDay({
        days: schedule.delivery_days,
        asOf: now,
      }),
    }))
    .filter(
      (entry): entry is { schedule: DeliverySchedule; nextDelivery: Date } =>
        entry.nextDelivery !== null
    )

  if (valid.length === 0) return ''

  const todayLabel = format(now, "d 'de' MMMM", { locale: es })

  const customerMatch =
    options.customerCity != null
      ? findSchedule(
          valid.map((entry) => entry.schedule),
          options.customerCity
        )
      : null
  const customerEntry =
    customerMatch != null
      ? valid.find((entry) => entry.schedule.city === customerMatch.city)
      : null
  const customerLine =
    customerMatch != null && customerEntry != null
      ? `El cliente actual está en ${customerMatch.city}: próxima entrega ${formatDeliveryDay(
          customerEntry.nextDelivery
        )} entre ${formatTime(customerMatch.delivery_window_start)} y ${formatTime(
          customerMatch.delivery_window_end
        )}.`
      : ''

  const listLines = valid.map(({ schedule, nextDelivery }) => {
    const daysLabel = formatDeliveryDaysList(schedule.delivery_days)
    return `- ${schedule.city}: ${daysLabel} (${formatTime(
      schedule.delivery_window_start
    )} a ${formatTime(schedule.delivery_window_end)}) — próxima entrega: ${formatDeliveryDay(
      nextDelivery
    )}`
  })

  return `## Días de entrega
Ningún pedido se entrega el mismo día: siempre se entrega el SIGUIENTE día programado de la ciudad del cliente. Fechas calculadas al ${todayLabel}:
${listLines.join('\n')}
${customerLine ? `${customerLine}\n` : ''}REGLAS:
1. Para "¿cuándo llega mi pedido?" usa SIEMPRE la fecha calculada de la ciudad del cliente.
2. Al CONFIRMAR un pedido, informa obligatoriamente el día de entrega calculado y el horario de esa ciudad (ej. "Te llegará el <día calculado>, entre <hora inicio> y <hora fin>").
3. Nunca prometas otra fecha distinta a la calculada ni digas que llega "hoy" o "mañana" sin el día exacto.
4. Si la ciudad del cliente no tiene días configurados, di que el equipo coordina la entrega; no inventes fechas.`
}