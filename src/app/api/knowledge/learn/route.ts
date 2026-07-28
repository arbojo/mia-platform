import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { extractKnowledgeFromText } from '@/lib/ai/extract'
import { getBusinessExtractionContext } from '@/lib/ai/knowledge'
import { PDFParse } from 'pdf-parse'

const MAX_FILES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/', 'application/pdf', 'text/']

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(buffer) })
  const result = await parser.getText()
  return result.text
}

async function extractTextFromImage(
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

async function extractTextFromFile(file: File): Promise<string> {
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const businessId = formData.get('business_id') as string
  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const files: File[] = []
  for (const [key, value] of formData.entries()) {
    if (key === 'business_id') continue
    if (value instanceof File) {
      files.push(value)
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File "${file.name}" exceeds 10MB limit` }, { status: 400 })
    }
    const isAllowed = ALLOWED_TYPES.some((t) => file.type.startsWith(t) || file.type === t)
    if (!isAllowed) {
      return NextResponse.json({ error: `File type "${file.type}" not supported` }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  const { data: assistant } = await admin
    .from('assistants')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const { count: knowledgeCount } = await admin
    .from('knowledge_items')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)

  const { count: productCount } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)

  const preparationBefore = Math.min(100, ((knowledgeCount ?? 0) + (productCount ?? 0)) * 3)

  const { data: report, error: reportError } = await admin
    .from('learning_reports')
    .insert({
      business_id: businessId,
      status: 'processing',
      preparation_before: preparationBefore,
      files_processed: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    })
    .select('id')
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  try {
    const allText: string[] = []
    for (const file of files) {
      const text = await extractTextFromFile(file)
      if (text.trim().length > 0) {
        allText.push(`--- Archivo: ${file.name} ---\n${text}`)
      }
    }

    if (allText.length === 0) {
      await admin
        .from('learning_reports')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', report.id)

      return NextResponse.json({
        error: 'No pude leer información de los archivos. Asegúrate de que contengan texto visible.',
      }, { status: 422 })
    }

    const combinedText = allText.join('\n\n')
    const extractionCtx = await getBusinessExtractionContext(businessId)
    const businessContext = [
      'Productos existentes:', extractionCtx.existingProducts.join(', ') || 'Ninguno',
      'Conocimiento existente:', extractionCtx.existingKnowledge.map((k) => `${k.category}: ${k.content}`).join('; ') || 'Ninguno',
      'Reglas existentes:', extractionCtx.existingRules.map((r) => `${r.category}: ${r.content}`).join('; ') || 'Ninguna',
    ].join('\n')

    const extraction = await extractKnowledgeFromText(
      combinedText,
      businessContext,
      businessId,
      assistant?.id ?? businessId
    )

    const preparationAfter = Math.min(100, preparationBefore +
      extraction.summary.productsFound * 3 +
      extraction.summary.knowledgeFound * 2 +
      extraction.summary.rulesFound * 2 +
      extraction.summary.faqsFound
    )

    await admin
      .from('learning_reports')
      .update({
        status: 'completed',
        products_found: extraction.summary.productsFound,
        knowledge_found: extraction.summary.knowledgeFound,
        rules_found: extraction.summary.rulesFound,
        prices_found: extraction.summary.pricesFound,
        benefits_found: extraction.summary.benefitsFound,
        faqs_found: extraction.summary.faqsFound,
        promotions_found: extraction.summary.promotionsFound,
        missing_fields: extraction.missingFields,
        extracted_products: extraction.products,
        extracted_knowledge: extraction.knowledge,
        extracted_rules: extraction.rules,
        preparation_after: preparationAfter,
        completed_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    return NextResponse.json({
      report_id: report.id,
      status: 'completed',
      summary: extraction.summary,
      preparation_before: preparationBefore,
      preparation_after: preparationAfter,
    })
  } catch (error) {
    await admin
      .from('learning_reports')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', report.id)

    return NextResponse.json({
      error: 'Error al analizar los archivos. Intenta de nuevo.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
