import { describe, it, expect } from 'vitest'
import {
  isInstructionLike,
  toRejectionReason,
  MIN_INSTRUCTION_CHARS,
} from '@/lib/knowledge/validation'
import {
  findLeakSources,
  groupDuplicates,
  normalizeLeakText,
  type LeakMessage,
} from '@/lib/knowledge/leakage'

/** Una instrucción real: larga, en forma de comportamiento, nunca citada de una conversación. */
const REGLA_REAL =
  'Decir el límite real del producto y reencuadrar en la misma frase. No prometer resultados que la vendedora no prometería.'

/** Textos que efectivamente se colaron como instrucciones permanente. */
const FRAGMENTOS_REALES = [
  'le llegaria hoy a partir de las 2 pm',
  'no hay costo en el envio',
  'una disculpa nuestro bot anda emocionado hoy',
  'claro!! igual puede agendarlo de una vez para ese dia y asegura su producto',
  'la uña afectada ya no se recupera , pero como puede ver en la foto, ayuda a que la nueña uña crezca limpia',
  'no se exactamente cuanto tarde en crecer la uña de nuevo con usted, los tiempos son diferentes para cada persona, por que dependen de su genetica',
]

function mensaje(content: string): LeakMessage {
  return { content, received_at: '2026-06-02T10:00:00Z', external_id: 'harvest:abc' }
}

describe('isInstructionLike', () => {
  it('acepta una instrucción real', () => {
    expect(isInstructionLike(REGLA_REAL)).toEqual({ ok: true })
  })

  it('rechaza texto vacío o ausente', () => {
    expect(isInstructionLike('').ok).toBe(false)
    expect(isInstructionLike('   ').ok).toBe(false)
    expect(isInstructionLike(null).ok).toBe(false)
    expect(isInstructionLike(undefined).ok).toBe(false)
  })

  it('rechaza los fragmentos que se colaron por ser demasiado cortos', () => {
    for (const fragmento of ['le llegaria hoy a partir de las 2 pm', 'no hay costo en el envio']) {
      expect(isInstructionLike(fragmento).ok).toBe(false)
    }
  })

  it('no puede aceptar un texto de menos del mínimo aunque sea largo en palabras', () => {
    expect(isInstructionLike('a'.repeat(MIN_INSTRUCTION_CHARS - 1)).ok).toBe(false)
    expect(isInstructionLike('a'.repeat(MIN_INSTRUCTION_CHARS)).ok).toBe(true)
  })
})

describe('findLeakSources', () => {
  it('detecta el texto que aparece literal en una conversación', () => {
    const messages = FRAGMENTOS_REALES.map((f) => mensaje(f))
    for (const fragmento of FRAGMENTOS_REALES) {
      expect(findLeakSources(fragmento, messages)).toHaveLength(1)
    }
  })

  it('no marca una instrucción sintetizada aunque comparta palabras con un mensaje', () => {
    const messages = [mensaje('no hay costo en el envio, lo confirmo mañana')]
    expect(findLeakSources(REGLA_REAL, messages)).toHaveLength(0)
  })

  it('ignora diferencias de mayúsculas y espacios', () => {
    const messages = [mensaje('LE LLEGARIA  HOY a partir de las 2 PM')]
    expect(findLeakSources('le llegaria hoy a partir de las 2 pm', messages)).toHaveLength(1)
  })

  it('devuelve vacío sin mensajes o con texto vacío', () => {
    expect(findLeakSources('cualquier cosa', [])).toHaveLength(0)
    expect(findLeakSources('   ', [mensaje('algo')])).toHaveLength(0)
  })
})

describe('groupDuplicates', () => {
  it('agrupa filas con texto idéntico', () => {
    const rows = FRAGMENTOS_REALES.slice(0, 1).concat(FRAGMENTOS_REALES.slice(0, 1)).map((instruction, index) => ({
      id: `id-${index}`,
      instruction,
      source: 'correction',
      is_active: true,
      created_at: '2026-10-04T05:09:00Z',
    }))
    const groups = groupDuplicates(rows)
    expect(groups.size).toBe(1)
    expect([...groups.values()][0]).toHaveLength(2)
  })

  it('no agrupa textos distintos', () => {
    const rows = [{ instruction: 'uno' }, { instruction: 'dos' }].map((row, index) => ({
      id: `id-${index}`,
      instruction: row.instruction,
      source: 'correction',
      is_active: true,
      created_at: '2026-10-04T05:09:00Z',
    }))
    expect(groupDuplicates(rows).size).toBe(0)
  })
})

describe('normalizeLeakText', () => {
  it('colapsa espacios y baja a minúsculas', () => {
    expect(normalizeLeakText('  HOLA   MUndo  ')).toBe('hola mundo')
  })
})

describe('toRejectionReason', () => {
  it('prioriza el motivo estructural sobre el de transcripción', () => {
    const reason = toRejectionReason(isInstructionLike('corto'), true)
    expect(reason).toMatch(/Demasiado corto/)
  })

  it('explica la coincidencia con una conversación', () => {
    const reason = toRejectionReason(isInstructionLike(REGLA_REAL), true)
    expect(reason).toMatch(/literalmente en una conversación/)
  })

  it('permite pasar texto válido sin coincidencia', () => {
    expect(toRejectionReason(isInstructionLike(REGLA_REAL), false)).toBeNull()
  })
})