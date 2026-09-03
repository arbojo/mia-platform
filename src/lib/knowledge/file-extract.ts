import { PDFParse } from 'pdf-parse'

/**
 * Extracción de texto por archivo — compartida entre el endpoint de recepción
 * (validación) y el worker asíncrono (TASK-20260209-ASYNCLEARN001).
 * Movida desde src/app/api/knowledge/learn/route.ts sin cambios de lógica.
 */

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(buffer) })
  const result = await parser.getText()
  return result.text
}

export async function extractTextFromImage(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const base64 = Buffer.from(buffer).toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const { getOpenAIClient, MODEL } = await import('@/lib/ai/client')
  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
          {
            type: 'text',
            text: `Extrae TODO el texto visible en esta imagen. Si es un catálogo, lista de precios, folleto o documento de negocio, extrae toda la información incluyendo nombres de productos, precios, descripciones, beneficios, promociones, y cualquier otro dato relevante.

Si la imagen no contiene texto relevante para un negocio, responde con un texto vacío.`,
          },
        ],
      },
    ],
    max_tokens: 4096,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function extractTextFromFile(file: {
  arrayBuffer: () => Promise<ArrayBuffer>
  type: string
  name: string
}): Promise<string> {
  const buffer = await file.arrayBuffer()

  if (file.type === 'application/pdf') {
    return extractTextFromPdf(buffer)
  }

  if (file.type.startsWith('image/')) {
    return extractTextFromImage(buffer, file.type)
  }

  if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    return new TextDecoder().decode(buffer)
  }

  return ''
}
