import { describe, it, expect } from 'vitest'
import {
  buildSafetyCorrectionPrompt,
  customerTextFrom,
  decideSafetyGuard,
  findSafetyViolations,
  type SafetyViolation,
} from '@/lib/runtime/safety-guard'

describe('decideSafetyGuard', () => {
  it('es opt-in: sin el flag del call site nunca interviene', () => {
    const d = decideSafetyGuard({
      enabled: false,
      customerText: 'tengo neuropatía diabética',
    })
    expect(d).toEqual({ apply: false, reason: 'disabled' })
  })

  it('aplica cuando el cliente ya nombró una condición crónica', () => {
    expect(
      decideSafetyGuard({
        enabled: true,
        customerText: 'Mi mamá tiene neuropatía diabética severa',
      }),
    ).toEqual({ apply: true })
  })

  it('INTERLOCK: se apaga si el cliente describe síntomas agudos', () => {
    // El caso donde derivar es lo correcto. El guard no debe tocarlo.
    for (const agudo of [
      'me duele el pecho y no puedo respirar',
      'tuve un accidente grave',
      'me desmayé en el trabajo',
      'tengo sangrado intenso desde anoche',
      'fui a urgencias',
      'I have chest pain and cannot breathe',
    ]) {
      expect(decideSafetyGuard({ enabled: true, customerText: agudo })).toEqual({
        apply: false,
        reason: 'acute_symptom',
      })
    }
  })

  it('un mensaje de VHS no dispara el interlock', () => {
    expect(decideSafetyGuard({ enabled: true, customerText: 'Escribe el mensaje de reenganche.' }).apply).toBe(true)
  })
})

describe('findSafetyViolations', () => {
  it('detecta la derivación y la etiqueta como referral', () => {
    const v = findSafetyViolations('Lo mejor sería consultar a un profesional de la salud.')
    expect(v.length).toBeGreaterThan(0)
    expect(v.every((x) => x.kind === 'referral')).toBe(true)
    expect(v[0].id).toBe('medical_referral')
  })

  it('detecta los claims y los etiqueta como claim', () => {
    for (const [texto, id] of [
      ['Este parche cura la neuropatía.', 'cures'],
      ['Es totalmente seguro de usar.', 'safety_absolute'],
      ['Ayuda a normalizar tu nivel de azúcar.', 'glucose_effect'],
      ['Es un medicamento con supervisión médica.', 'medicine'],
      ['No representa problema para la diabetes.', 'no_problem_for_condition'],
    ] as const) {
      const v = findSafetyViolations(texto)
      expect(v.some((x) => x.kind === 'claim' && x.id === id), `${texto} → ${id}`).toBe(true)
    }
  })

  it('deja pasar la divulgación honesta', () => {
    expect(findSafetyViolations('No son un tratamiento médico.')).toEqual([])
    expect(findSafetyViolations('No necesitas consultar al médico.')).toEqual([])
    expect(findSafetyViolations('Te ayuda con la comodidad de tus pies.')).toEqual([])
  })

  it('detecta las dos familias a la vez', () => {
    const v = findSafetyViolations('Es 100% seguro, y antes de comprar consulta a un médico.')
    const kinds = new Set(v.map((x) => x.kind))
    expect(kinds).toEqual(new Set(['claim', 'referral']))
  })
})

describe('customerTextFrom', () => {
  it('solo junta los turnos del cliente', () => {
    const text = customerTextFrom([
      { role: 'user', content: 'tengo neuropatía' },
      { role: 'assistant', content: 'te entiendo' },
      { role: 'user', content: 'y me duelen los pies' },
    ])
    expect(text).toContain('neuropatía')
    expect(text).toContain('pies')
    expect(text).not.toContain('te entiendo')
  })
})

describe('buildSafetyCorrectionPrompt', () => {
  const v = (kind: 'claim' | 'referral', id: string): SafetyViolation => ({
    kind,
    id,
    label: id,
    excerpt: id,
  })

  it('corrige la derivación y exige la divulgación honesta', () => {
    const prompt = buildSafetyCorrectionPrompt([v('referral', 'medical_referral')])
    expect(prompt).toMatch(/no le digas que consulte/i)
    expect(prompt).toMatch(/supervisión médica/i)
    // La parte que más importa: NO está prohibido aclarar que no es tratamiento.
    expect(prompt).toMatch(/no es un tratamiento médico/i)
    // Y no debe tocar precio ni producto.
    expect(prompt).toMatch(/no cambies el producto, el precio/i)
  })

  it('corrige un claim con su sustituto y sin pedir derivación', () => {
    const prompt = buildSafetyCorrectionPrompt([v('claim', 'cures')])
    expect(prompt).toMatch(/apoyo al día a día/i)
    // La trampa: la corrección de un claim no puede consistir en derivar.
    expect(prompt).toMatch(/no resuelvas esto mandándolo al médico/i)
  })

  it('no incluye reglas de claims cuando la violación es solo derivación', () => {
    const prompt = buildSafetyCorrectionPrompt([v('referral', 'medical_referral')])
    expect(prompt).not.toMatch(/apoyo al día a día/i)
    expect(prompt).not.toMatch(/no resuelvas esto mandándolo al médico/i)
  })

  it('cada claim conocido tiene sustituto propio', () => {
    for (const id of [
      'cures',
      'medicine',
      'safety_absolute',
      'glucose_effect',
      'fitness_for_condition',
      'no_problem_for_condition',
      'prevention',
    ]) {
      const prompt = buildSafetyCorrectionPrompt([v('claim', id)])
      expect(prompt.length, `sin sustituto para ${id}`).toBeGreaterThan(0)
      expect(prompt).toMatch(/no cambies el producto, el precio/i)
      expect(prompt).toMatch(/no resuelvas esto mandándolo al médico/i)
    }
  })

  it('maneja las dos familias juntas sin repetir el encabezado', () => {
    const prompt = buildSafetyCorrectionPrompt([
      v('referral', 'medical_referral'),
      v('claim', 'safety_absolute'),
    ])
    const encabezado = prompt.split('\n')[0]
    expect(ocurrencias(prompt, encabezado)).toBe(1)
    expect(prompt).toMatch(/no le digas que consulte/i)
    expect(prompt).toMatch(/nada de absolutos/i)
  })
})

function ocurrencias(texto: string, aguja: string): number {
  return texto.split(aguja).length - 1
}