import { config } from 'dotenv'
config({ path: '.env.local' })
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function main() {
  const docs = [
    { title: 'FAQ: Primeros pasos', content: 'P: ¿Cómo configuro mi equipo?\nR: Siga la guía de inicio rápido.', type: 'faq' },
    { title: 'Política de crédito para clientes', content: 'Línea de crédito inicial hasta $50,000 MXN.', type: 'policy' },
    { title: 'Catálogo: Equipo Profesional X200', content: 'Producto: Equipo X200\nPrecio: $12,999 MXN\nDescripción: Equipo profesional.', type: 'catalog' },
    { title: 'Instrucciones de atención al cliente', content: 'Salude al cliente por su nombre. Escuche activamente.', type: 'instructions' },
  ]

  for (const doc of docs) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Eres un sistema de extracción de información empresarial. Analiza el documento y clasifica su contenido en las siguientes tablas:

1. **products** — Productos con nombre, precio, descripción, beneficios
2. **knowledge_items** — Información general, FAQ, procedimientos, respuestas
3. **sales_rules** — Reglas de negocio, políticas, restricciones legales, pricing rules
4. **ai_instructions** — Instrucciones de comportamiento para el asistente
5. **business_memory** — Información operativa interna, procesos, memorándums

Responde SOLO con JSON:
{
  "category": "products|knowledge_items|sales_rules|ai_instructions|business_memory",
  "entities": [
    {
      "table": "products|knowledge_items|sales_rules|ai_instructions|business_memory",
      "data": { campos específicos de esa tabla }
    }
  ]
}` },
        { role: 'user', content: `Documento: ${doc.title}\n\n---\n\n${doc.content}` },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    console.log(`=== ${doc.title} ===`)
    console.log(raw)
    console.log()

    // Check the field names the LLM uses
    try {
      const parsed = JSON.parse(raw)
      if (parsed.entities) {
        for (const e of parsed.entities) {
          console.log(`  Table: ${e.table}, Data fields: ${Object.keys(e.data).join(', ')}`)
        }
      }
    } catch { /* skip */ }
    console.log()
  }
}

main().catch(console.error)
