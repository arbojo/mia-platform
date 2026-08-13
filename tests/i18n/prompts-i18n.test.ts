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

  it('enforces the reinforced commercial-domain fundamental rule', () => {
    const prompt = basePrompt()
    expect(prompt).toContain(
      'Tu dominio de conversación está estrictamente limitado a los productos, servicios y contexto de este negocio'
    )
    expect(prompt).toContain('NUNCA respondas con datos enciclopédicos')
    expect(prompt).toContain('desvío como un puente comercial')
    expect(prompt).toContain('Handoff humano cuando la negociación lo requiera.')
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
