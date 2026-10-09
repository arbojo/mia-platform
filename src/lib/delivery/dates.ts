import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface DeliverySchedule {
  city: string
  delivery_days: number[]
  delivery_window_start: string
  delivery_window_end: string
}

export interface DeliveryOverride {
  city: string
  start_date: string
  end_date: string
  delivery_days: number[]
  delivery_window_start?: string | null
  delivery_window_end?: string | null
  note?: string | null
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

/** "09:00" (o "09:00:00") → "9:00", "19:00" → "19:00" */
export function formatTime(value: string): string {
  const normalized = value.length > 5 ? value.slice(0, 5) : value
  const hour = normalized.slice(0, 2)
  return `${hour.startsWith('0') ? hour.slice(1) : hour}${normalized.slice(2)}`
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

/** Override que cubre `date` para `city`, o undefined. */
function overrideForDate(
  overrides: DeliveryOverride[],
  city: string,
  date: Date
): DeliveryOverride | undefined {
  const target = normalizeCity(city)
  const dateStr = format(date, 'yyyy-MM-dd')
  return overrides.find((o) => {
    if (normalizeCity(o.city) !== target) return false
    return o.start_date <= dateStr && dateStr <= o.end_date
  })
}

/**
 * Próximo día de entrega de una ciudad considerando overrides por fecha.
 * Si un override cubre un día candidato, sus días reemplazan a los del
 * calendario base para ESE día; en caso contrario se usa el base.
 * Regla de negocio: nunca se entrega el mismo día.
 */
export function getEffectiveNextDeliveryDay(params: {
  schedules: DeliverySchedule[]
  overrides?: DeliveryOverride[]
  city: string
  asOf?: Date
}): Date | null {
  const base = findSchedule(params.schedules, params.city)
  if (!base || base.delivery_days.length === 0) return null

  const cursor = new Date(params.asOf ?? new Date())
  cursor.setDate(cursor.getDate() + 1)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < 14; i += 1) {
    const override = overrideForDate(params.overrides ?? [], params.city, cursor)
    const allowed = new Set(
      (override ? override.delivery_days : base.delivery_days).filter(
        (d) => Number.isInteger(d) && d >= 0 && d <= 6
      )
    )
    if (allowed.has(cursor.getDay())) return new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

export interface DeliveryPromptSectionOptions {
  schedules: DeliverySchedule[]
  overrides?: DeliveryOverride[]
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
  const { schedules, overrides } = options
  const now = options.now ?? new Date()

  const valid = schedules
    .map((schedule) => ({
      schedule,
      nextDelivery: getEffectiveNextDeliveryDay({
        schedules,
        overrides: overrides ?? [],
        city: schedule.city,
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
  const customerOverride = overrideForDate(overrides ?? [], customerMatch?.city ?? '', now)
  const customerWindow = formatWindowQuick(
    customerOverride ?? scheduleToOverride(customerMatch)
  )
  const finalCustomerLine =
    customerMatch != null && customerEntry != null
      ? `El cliente actual está en ${customerMatch.city}: próxima entrega ${formatDeliveryDay(
          customerEntry.nextDelivery
        )}${overrideSuffix(customerOverride)}${customerWindow}.`
      : ''

  const listLines = valid.map(({ schedule, nextDelivery }) => {
    const daysLabel = formatDeliveryDaysList(schedule.delivery_days)
    const ov = overrideForDate(overrides ?? [], schedule.city, now)
    return `- ${schedule.city}: ${daysLabel} (${formatTime(
      schedule.delivery_window_start
    )} a ${formatTime(schedule.delivery_window_end)}) — próxima entrega: ${formatDeliveryDay(
      nextDelivery
    )}${overrideSuffix(ov)}`
  })

  return `## Días de entrega
Ningún pedido se entrega el mismo día: siempre se entrega el SIGUIENTE día programado de la ciudad del cliente. Fechas calculadas al ${todayLabel}:
${listLines.join('\n')}
${finalCustomerLine ? `${finalCustomerLine}\n` : ''}REGLAS:
1. Para "¿cuándo llega mi pedido?" usa SIEMPRE la fecha calculada de la ciudad del cliente.
2. Al CONFIRMAR un pedido, informa obligatoriamente el día de entrega calculado y el horario de esa ciudad (ej. "Te llegará el <día calculado>, entre <hora inicio> y <hora fin>").
3. Nunca prometas otra fecha distinta a la calculada ni digas que llega "hoy" o "mañana" sin el día exacto.
4. Si la ciudad del cliente no tiene días configurados, di que el equipo coordina la entrega; no inventes fechas.`
}

function scheduleToOverride(s: DeliverySchedule | null): DeliveryOverride | null {
  if (!s) return null
  return {
    city: s.city,
    start_date: '',
    end_date: '',
    delivery_days: s.delivery_days,
    delivery_window_start: s.delivery_window_start,
    delivery_window_end: s.delivery_window_end,
  }
}

function overrideSuffix(o: DeliveryOverride | null | undefined): string {
  if (!o || !o.note) return ''
  return ` (${o.note.trim()})`
}

function formatWindowQuick(o: DeliveryOverride | null | undefined): string {
  if (!o) return ''
  const start = o.delivery_window_start
  const end = o.delivery_window_end
  if (!start || !end) return ''
  return ` entre ${formatTime(start.slice(0, 5))} y ${formatTime(end.slice(0, 5))}`
}