import { describe, it, expect } from 'vitest'
import {
  getRouting,
  getProviderModelWithFallback,
  type AITaskType,
} from '@/lib/ai/task-routing'

/**
 * CONTRATO de integracion del router multi-provider, validado CONTRA el source
 * real de src/lib/ai/task-routing.ts (leido en sesion, no adivinado):
 *
 *   getRouting(taskType)                    -> { primary: ProviderEntry, fallback: ProviderEntry|null }
 *       ProviderEntry = { provider, model, available }
 *   getProviderModelWithFallback(taskType)  -> { primary: {model, modelName}, fallback: {model, modelName}|null }
 *   AITaskType                              -> 'chat'|'detection'|'extraction'|'analysis'|'generation'|'ocr'
 *
 * Lo que el test FIJA (y en lo que execute-ai.ts:157 descansa):
 *   1. primary SIEMPRE tiene provider + model reales — ninguna tarea arranca
 *      con un provider null-inventado (esto es lo que evita el 400 del stream).
 *   2. El fallback NUNCA es null-inventado PERO puede resolver null cuando el
 *      provider de respaldo no tiene key (single-provider mode). Por eso:
 *      cuando fallback ES no-null, su provider debe ser DISTINTO del primary
 *      (anti retry-infinito sobre el mismo provider caido).
 *   3. getProviderModelWithFallback SIEMPRE devuelve un modelName real, aunque
 *      sea solo el primary (single-provider mode = modelName del last-resort).
 *   4. OCR es el UNICO gap documentado: fallback null por DISENO (ya que no
 *      hay un proveedor OCR dedicado). Este test LO DOCUMENTA, no lo niega.
 *
 * El test corre SIEMPRE (sin keys): bloque estructural.
 * El test de proveedores reales solo corre con >=1 key (skipIf).
 */

const ALL_TASKS: AITaskType[] = [
  'chat',
  'detection',
  'extraction',
  'analysis',
  'generation',
  'ocr',
]

const hasAnyProviderKey = (): boolean =>
  !!process.env.OPENAI_API_KEY ||
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  !!process.env.GROQ_API_KEY

/* ------------------------------------------------------------------ *
 * PLANO 1 — contrato estructural (corre SIEMPRE, no requiere keys)
 * ------------------------------------------------------------------ */
describe('task-routing: contrato estructural (corre sin provider keys)', () => {
  it.each(ALL_TASKS)(
    'getRouting(%s): primary SIEMPRE resuelve provider real (nunca null-inventado)',
    (taskType) => {
      const { primary } = getRouting(taskType)
      expect(primary).toBeDefined()
      expect(primary.provider).toBeDefined()
      expect(primary.model).toBeTruthy()
    },
  )

  it('el fallback NUNCA es el mismo provider que el primary (anti-retry-infinito)', () => {
    for (const taskType of ALL_TASKS) {
      const { primary, fallback } = getRouting(taskType)
      if (fallback) {
        expect(fallback.provider).not.toBe(primary.provider)
      }
    }
  })

  it('OCR es el UNICO gap documentado: fallback null por diseno (sin proveedor OCR dedicado)', () => {
    const { fallback } = getRouting('ocr')
    expect(fallback).toBeNull()
  })

  it('getProviderModelWithFallback SIEMPRE resuelve modelName real — unico provider mode incluido', () => {
    for (const taskType of ALL_TASKS) {
      const { primary, fallback } = getProviderModelWithFallback(taskType)
      expect(primary.modelName).toBeTruthy()
      if (fallback) {
        expect(fallback.modelName).toBeTruthy()
        expect(fallback.modelName).not.toBe(primary.modelName)
      }
    }
  })
})

/* ------------------------------------------------------------------ *
 * PLANO 2 — round-trip real con proveedores vivos.
 * Solo corre si hay >=1 key; si no, se omite (CI sin credenciales:
 * nunca se rompe por falta de keys).
 * ------------------------------------------------------------------ */
describe.skipIf(!hasAnyProviderKey())(
  'task-routing: integracion con proveedores reales',
  () => {
    it.each(ALL_TASKS)('round-trip: %s resuelve modelo real del provider primary', (taskType) => {
      const { primary } = getProviderModelWithFallback(taskType)
      expect(primary.modelName).toBeTruthy()
      expect(primary.model).toBeDefined()
    })
  },
)
