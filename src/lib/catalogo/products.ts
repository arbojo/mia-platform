export type CatalogProduct = {
  slug: string
  name: string
  eyebrow: string
  tagline: string
  benefits: string[]
  price: string
  priceNote?: string
  image: string
  imageAlt: string
  accent: string
  waMessage: string
}

export const RENDER_ORIGIN =
  'https://hhitqgsaglddjkmaovbs.supabase.co/storage/v1/object/public/knowledge-media/4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

export const BRAND_IMAGE = `${RENDER_ORIGIN}/vitanova.png`

export const WA_PHONE = '524775250039'

export function buildWhatsAppHref(message: string): string {
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(message)}`
}

export const HERO_WA_MESSAGE = 'Hola MIA 👋 Vi el catálogo de Vitanova y quiero información.'
export const CLOSING_WA_MESSAGE = 'Hola MIA 👋 Vi el catálogo y me interesa uno de tus productos.'

export const catalogProducts: CatalogProduct[] = [
  {
    slug: 'neurotin',
    name: 'Neurotin',
    eyebrow: 'Soporte · Pie y tobillo',
    tagline: 'Soporte discreto para tu arco, talón y tobillo.',
    benefits: ['Punta abierta, discreto con tu calzado', 'Cómodo para caminar mucho', 'Ayuda a aliviar el pie cansado, ideal para quien pasa mucho tiempo de pie'],
    price: '3 por $449',
    priceNote: 'o 5 por $699',
    image: `${RENDER_ORIGIN}/cc067df6-51e2-4be5-8c0c-6603eb2ee5e7.png`,
    imageAlt: 'Calcetín Neurotin de soporte para pie y tobillo',
    accent: '91 155 213',
    waMessage: 'Hola MIA 👋 Me interesa Neurotin y quiero saber más.',
  },
  {
    slug: 'clean-nails',
    name: 'Clean Nails',
    eyebrow: 'Cuidado · En casa',
    tagline: 'Luz UV que acompaña el cuidado de tu uña.',
    benefits: ['Discreto, de uso en casa', 'Cambios graduales, con constancia', 'Envío gratis', 'Ayuda a eliminar el hongo de la uña'],
    price: '$599',
    image: `${RENDER_ORIGIN}/6d152770-357c-4f6f-bfbd-8f8507885926.jpg`,
    imageAlt: 'Luz UV Clean Nails para el cuidado de las uñas',
    accent: '45 212 191',
    waMessage: 'Hola MIA 👋 Me interesa Clean Nails y quiero saber más.',
  },
  {
    slug: 'neurofeet',
    name: 'Neurofeet',
    eyebrow: 'Compresión · 20–30 mmHg',
    tagline: 'Compresión que acompaña tus jornadas de pie.',
    benefits: ['Ayuda con la pesadez de piernas', 'Apoyo de comodidad', 'Ayuda a aliviar problemas de mala circulación, varices y molestias de la neuropatía'],
    price: '3 por $449',
    priceNote: '3 pares al precio de 1',
    image: `${RENDER_ORIGIN}/fe571b6f-8dd9-4ea8-8e2b-83b5125e7258.jpg`,
    imageAlt: 'Calcetines de compresión graduada Neurofeet',
    accent: '129 140 248',
    waMessage: 'Hola MIA 👋 Me interesa Neurofeet y quiero saber más.',
  },
  {
    slug: 'back2fit',
    name: 'Back2Fit',
    eyebrow: 'Moldeador · Masculino',
    tagline: 'Delgado, transpirable, y se acomoda natural.',
    benefits: [
      'Efecto visible al momento: disimula esos kilitos de más y luce una figura más estilizada al instante',
      'Discreta bajo la ropa: úsala con tu outfit sin llamar la atención',
      'Acompaña tu proceso al bajar de peso: soporte para el vientre mientras trabajas en tu objetivo',
      'Perfecta para ocasiones especiales: úsala cuando quieres verte y sentirte increíble',
    ],
    price: '$499',
    priceNote: '2 piezas ahorran 20% · 3 hasta 30%',
    image: `${RENDER_ORIGIN}/5bd5886a-15b2-41a6-a4a0-534604101dd5.jpg`,
    imageAlt: 'Chaleco moldeador masculino Back2Fit',
    accent: '148 163 184',
    waMessage: 'Hola MIA 👋 Me interesa Back2Fit y quiero saber más.',
  },
  {
    slug: 'bella-patch',
    name: 'Bella Patch',
    eyebrow: 'Belleza · Lifting temporal',
    tagline: '60 tiras para un efecto lifting en tu momento especial.',
    benefits: ['Invisibles bajo maquillaje', 'Efecto temporal', 'Disimula líneas de expresión y arrugas, ideal para un evento importante'],
    price: '$499',
    priceNote: '≈ $16.6 por puesta',
    image: `${RENDER_ORIGIN}/34795f9d-7fa3-4075-8fc6-eab8e485c692.jpg`,
    imageAlt: 'Tiras tensoras faciales Bella Patch',
    accent: '244 114 182',
    waMessage: 'Hola MIA 👋 Me interesa Bella Patch y quiero saber más.',
  },
]