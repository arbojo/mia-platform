import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/runtime/execute-ai', () => ({ executeAI: vi.fn() }))
vi.mock('@/lib/runtime/safety-guard', () => ({ findSafetyViolations: vi.fn() }))

import { executeAI } from '@/lib/runtime/execute-ai'
import { findSafetyViolations } from '@/lib/runtime/safety-guard'
import { humanizeReply, buildHumanizePrompt } from '@/lib/runtime/humanizer'

const BASE = {
  businessId: 'b1111111-1111-1111-1111-111111111111',
  assistantId: 'a1111111-1111-1111-1111-111111111111',
  requestType: 'live_customer',
  customerText: '¿el parche me puede curar?',
}

// Borrador típico post-guard: esqueleto canónico con disclaimer y cierre de venta.
const LONG_REPLY =
  'Entiendo que ya conoces tu situación. El Diabetic Patch es un complemento alimenticio que apoya tu rutina diaria y no es un tratamiento médico. Se coloca cada 24 horas y el pack de 36 parches cuesta $449. ¿Te gustaría hacer un pedido?'

const humanized = 'Mira, te cuento: el parche apoya tu rutina diaria, no es un tratamiento médico. Se usa cada 24 horas y el pack de 36 parches está en $449. ¿Lo probamos?'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findSafetyViolations).mockReturnValue([])
})

it('no llama al LLM para respuestas triviales (< umbral)', async () => {
  const short = '¡Hola! ¿Cómo estás?' // < MIN_REPLY_LENGTH
  const out = await humanizeReply({ ...BASE, reply: short })
  expect(out).toBe(short)
  expect(executeAI).not.toHaveBeenCalled()
})

it('incluye contexto del cliente y el borrador en el prompt', async () => {
  const expected = buildHumanizePrompt(LONG_REPLY, BASE.customerText)
  expect(expected).toContain('Borrador de la respuesta a reescribir:')
  expect(expected).toContain(LONG_REPLY)
  expect(expected).toContain(BASE.customerText)
})

it('devuelve el borrador si la reescritura falla', async () => {
  vi.mocked(executeAI).mockRejectedValueOnce(new Error('boom'))
  const out = await humanizeReply({ ...BASE, reply: LONG_REPLY })
  expect(out).toBe(LONG_REPLY)
})

it('devuelve el borrador si la reescritura queda vacía', async () => {
  vi.mocked(executeAI).mockResolvedValueOnce({
    content: '  \n  ',
    usage: { promptTokens: 10, completionTokens: 5 },
  })
  const out = await humanizeReply({ ...BASE, reply: LONG_REPLY })
  expect(out).toBe(LONG_REPLY)
})

it('descarta la reescritura si reintroduce una violación de seguridad', async () => {
  vi.mocked(executeAI).mockResolvedValueOnce({
    content: 'Este parche cura la diabetes en semanas.',
    usage: { promptTokens: 10, completionTokens: 5 },
  })
  vi.mocked(findSafetyViolations).mockReturnValueOnce([
    { kind: 'claim', id: 'cures', label: 'cure', excerpt: 'cura la diabetes' },
  ])
  const out = await humanizeReply({ ...BASE, reply: LONG_REPLY })
  expect(out).toBe(LONG_REPLY)
})

it('devuelve la reescritura segura y usó executeAI con el pedido correcto', async () => {
  vi.mocked(executeAI).mockResolvedValueOnce({
    content: humanized,
    usage: { promptTokens: 10, completionTokens: 5 },
  })
  const out = await humanizeReply({ ...BASE, reply: LONG_REPLY })
  expect(out).toBe(humanized)
  expect(executeAI).toHaveBeenCalledTimes(1)
  const call = vi.mocked(executeAI).mock.calls[0]![0]
  expect(call.mode).toBe('complete')
  expect(call.taskType).toBe('chat')
  expect(call.requestType).toBe('live_customer')
  expect(call.temperature).toBe(0.9)
})