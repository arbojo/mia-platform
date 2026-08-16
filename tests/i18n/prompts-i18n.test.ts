import { describe, it, expect } from 'vitest'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import {
  mockAssistant,
  mockBusiness,
  mockBrandIdentity,
  mockProducts,
  mockRules,
  mockInstructions,
  mockKnowledgeItems,
} from '../fixtures'

function basePrompt(locale?: 'es' | 'en' | 'pt' | 'ja') {
  return buildMasterPrompt({
    business: mockBusiness,
    brand: mockBrandIdentity,
    assistant: mockAssistant,
    products: mockProducts,
    rules: mockRules,
    instructions: mockInstructions,
    knowledge: mockKnowledgeItems,
    locale,
  })
}

describe('buildMasterPrompt i18n', () => {
  it('defaults to Spanish when no locale is provided', () => {
    const prompt = basePrompt()
    expect(prompt).toContain('Tu Objetivo')
    expect(prompt).toContain('Reglas Fundamentales')
  })

  it('enforces the council directive fundamental rules (1-4) and preserved operational rules (5-7)', () => {
    const prompt = basePrompt()
    expect(prompt).toContain(
      'NUNCA inventes información, precios, características ni productos que no estén explícitamente registrados'
    )
    expect(prompt).toContain('temas ajenos al negocio')
    expect(prompt).toContain('úsalo amablemente como un puente')
    expect(prompt).toContain('no está disponible en tus fuentes')
    expect(prompt).toContain('Déjame revisar eso con el equipo')
    expect(prompt).toContain(
      'Tu conocimiento comercial está delimitado única y exclusivamente por el catálogo, las reglas de venta y la documentación provista por este inquilino.'
    )
    expect(prompt).toContain('Pregunta la ciudad SOLO cuando el cliente pida envío/entrega o muestre intención de compra')
    expect(prompt).toContain('No menciones descuentos a menos que el cliente pregunte')
    expect(prompt).toContain('Handoff humano cuando la negociación lo requiera.')
  })

  it('includes the council directive role purpose and response format section', () => {
    const prompt = basePrompt()
    expect(prompt).toContain(
      'Tu propósito principal es guiar al cliente, resolver sus dudas comerciales basándote estrictamente en el inventario y las reglas provistas'
    )
    expect(prompt).toContain('Formato de Respuesta')
    expect(prompt).toContain(
      'Mantén un tono cercano, profesional y enfocado en el beneficio del cliente.'
    )
    expect(prompt).toContain(
      'Cuando recomiendes un artículo, menciona su nombre, su valor y resalta cómo resuelve su necesidad específica'
    )
  })

  it('uses Spanish keys for locale es', () => {
    const prompt = basePrompt('es')
    expect(prompt).toContain('Tu Objetivo')
    expect(prompt).toContain('Tu Personalidad')
    expect(prompt).toContain('Estilo de Comunicación')
    expect(prompt).toContain('Reglas de Venta')
  })

  it('uses English keys for locale en', () => {
    const prompt = basePrompt('en')
    expect(prompt).toContain('Your Objective')
    expect(prompt).toContain('Your Personality')
    expect(prompt).toContain('Communication Style')
    expect(prompt).toContain('Sales Rules')
    expect(prompt).not.toContain('Tu Objetivo')
  })

  it('uses Portuguese keys for locale pt', () => {
    const prompt = basePrompt('pt')
    expect(prompt).toContain('Seu Objetivo')
    expect(prompt).toContain('Regras de Venda')
    expect(prompt).not.toContain('Tu Objetivo')
  })

  it('uses Japanese keys for locale ja', () => {
    const prompt = basePrompt('ja')
    expect(prompt).toContain('あなたの目的')
    expect(prompt).toContain('基本ルール')
    expect(prompt).not.toContain('Tu Objetivo')
  })

  it('keeps business data content regardless of locale', () => {
    const prompt = basePrompt('en')
    expect(prompt).toContain('Test Business')
    expect(prompt).toContain('Bota de Cuero')
    expect(prompt).toContain('Somos una tienda de prueba.')
  })
})
