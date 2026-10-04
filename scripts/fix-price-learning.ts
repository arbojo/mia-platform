import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const CATEGORY = 'un_precio_por_producto'

/**
 * Correccion de un aprendizaje insertado con evidencia equivocada.
 *
 * La primera version afirmaba que Clean Nails estaba a $550 en 24 conversaciones
 * y a $499/$799 en 12, y que habia que corregir el catalogo. Al verificarlo:
 *
 *  - el catalogo dice 550 y es correcto;
 *  - $499/$799 aparece solo del 2 al 3 de junio, y $550 del 25 al 26 de julio:
 *    hubo un CAMBIO DE PRECIO legitimo, no un dato obsoleto;
 *  - el unico "$499 posterior" era el precio de Neurofeet dentro de un mensaje
 *    multiproducto,contamination por un filtro que cruzaba el nombre del producto
 *    con cualquier precio de la misma cadena.
 *
 * El problema real que si quedo demostrado es otro: el catalogo guarda un solo
 * precio por producto, pero hay productos que se venden en varios tamanos, y
 * hay confirmaciones de pedido que citan productos que no existen en el catalogo.
 */
const CORRECTED = {
  correction_type: 'product',
  severity: 'critical',
  original_response:
    'Hola, Gabriela 😊📦 Somos el equipo de entregas de Kusanali. Tu pedido quedó registrado correctamente. [...] Detalles de tu pedido: Producto: Diabetic patch Cantidad: 36 Entrega programada: 2026-06-03 Monto a pagar al recibir: $399 ¡Gracias por tu compra! 🙌',
  corrected_response: null,
  knowledge_change: {
    learning:
      'El precio de un pedido debe derivarse del catálogo. Hoy el catálogo solo admite UN precio por producto, pero hay productos que se venden en varios tamaños (Bye Canas: $399 el medio litro y $550 el litro; Neurofeet: 3 pares y 4 pares), asi que la confirmacion de pedido no puede calcular el importe. Además hay confirmaciones que citan productos inexistentes en el catálogo. Antes de cerrar venta hay que verificar el monto contra el registro del producto y de su tamaño, nunca contra un valor escrito a mano.',
    source: 'whatsapp_harvest_2026-05-28_2026-08-01',
    evidence: {
      messages: 10,
      conversations: 5,
      quotes: [
        'Bye Canas: 6 confirmaciones a $550 y 2 a $399 para el mismo producto con tamanos distintos; el catalogo tiene un unico precio (499).',
        'Neurofeet: citado como "4 pares = $499" y como "3 pares = $499"; el catalogo dice 449.',
        '"Diabetic patch" aparece en 2 confirmaciones de pedido y NO existe en el catalogo de productos.',
        'Una confirmacion declara "Cantidad: 36" con un total de $399.',
        'CORRECCION: Clean Nails NO tiene conflicto de precio. $499/$799 (2-3 jun) y $550 (25-26 jul) son el mismo producto antes y despues de un cambio de precio. El catalogo (550) es correcto.',
      ],
    },
    proposed_by: 'harvest_analysis_2026-10-02',
    approved: false,
    supersedes_reason:
      'La primera version de este aprendizaje atribuyo a Clean Nails un conflicto de precio inexistente. Corregido tras verificar la cronologia y cruzar producto con precio en la misma cadena.',
  },
}

async function main() {
  const admin = createAdminClient()

  const { data: before, error: bErr } = await admin
    .from('learning_events')
    .select('id, category, knowledge_change')
    .eq('business_id', BUSINESS_ID)
    .eq('category', CATEGORY)
    .single()
  if (bErr) throw bErr

  console.log('APRENDIZAJE ANTES DE CORREGIR:')
  console.log(
    `   ${(before.knowledge_change as Record<string, unknown>).learning as string}`
  )
  console.log()

  const { data, error } = await admin
    .from('learning_events')
    .update(CORRECTED)
    .eq('id', before.id)
    .select('id, category, correction_type, severity, status')
    .single()
  if (error) throw error

  console.log('APRENDIZAJE DESPUES DE CORREGIR:')
  const { data: after, error: aErr } = await admin
    .from('learning_events')
    .select('category, correction_type, severity, status, knowledge_change')
    .eq('id', data.id)
    .single()
  if (aErr) throw aErr

  const kc = after.knowledge_change as Record<string, unknown>
  console.log(`   [${after.status}] ${after.correction_type} / ${after.severity}`)
  console.log(`   ${kc.learning as string}`)
  console.log()
  const ev = kc.evidence as { quotes?: string[] }
  for (const q of ev.quotes ?? []) console.log(`   - ${q}`)
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})