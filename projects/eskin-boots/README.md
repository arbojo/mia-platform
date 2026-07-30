# Eskin Boots - Proyecto MIA

Proyecto independiente para configurar MIA Platform como asistente de ventas para Eskin Boots.

## Estructura

```
projects/eskin-boots/
├── README.md                    # Este archivo
├── config/
│   └── setup.md                 # Configuracion del negocio
├── seed/
│   └── eskin-boots-data.ts      # Datos para seed de la BD
└── docs/
    └── (documentacion pendiente)
```

## Como Usar

### 1. Ejecutar el Seed

El seed crea toda la configuracion inicial en la base de datos de MIA:

```typescript
import { ESKIN_BOOTS_DATA } from './seed/eskin-boots-data'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

// Crear business
const { data: business } = await supabase
  .from('businesses')
  .insert(ESKIN_BOOTS_DATA.business)
  .select()
  .single()

// Crear brand identity
await supabase
  .from('brand_identities')
  .insert({
    business_id: business.id,
    ...ESKIN_BOOTS_DATA.brand,
  })

// Crear assistant
const { data: assistant } = await supabase
  .from('assistants')
  .insert({
    business_id: business.id,
    ...ESKIN_BOOTS_DATA.assistant,
  })
  .select()
  .single()

// Crear canal web
await supabase
  .from('assistant_channels')
  .insert({
    assistant_id: assistant.id,
    channel: 'web',
  })

// Crear productos
await supabase
  .from('products')
  .insert(
    ESKIN_BOOTS_DATA.products.map(p => ({
      business_id: business.id,
      ...p,
    }))
  )

// Crear reglas
await supabase
  .from('sales_rules')
  .insert(
    ESKIN_BOOTS_DATA.rules.map((r, i) => ({
      business_id: business.id,
      ...r,
      priority: i,
    }))
  )

// Crear instrucciones
await supabase
  .from('ai_instructions')
  .insert(
    ESKIN_BOOTS_DATA.instructions.map(i => ({
      business_id: business.id,
      ...i,
      source: 'manual',
    }))
  )
```

### 2. Verificar el Seed

Despues de ejecutar el seed, verifica en el dashboard de MIA:

- Business "Eskin Boots" con status `ready`
- 18 productos con precios y descripciones
- 8 reglas de venta categorizadas
- 5 instrucciones IA
- Assistant "Eskin" con personalidad configurada

### 3. Probar el Chat

Ve a `/dashboard/assistants/[id]/training` para probar el chat con la configuracion de Eskin Boots.

## Datos Incluidos

### Productos (18)

| Modelo | Precio | Material |
|--------|--------|----------|
| Grisly Negro Est. Nicole | $2,900 | Piel de res |
| Estambul Arena Est. Yalira | $2,900 | Piel de res |
| Grisly Negro Est. Steve | $2,900 | Piel de res |
| Cabra Negro Kira | $3,300 | Piel de cabra |
| Wash Off Forest Est. Auriane | $2,900 | Piel de res |
| Grisly Negro Est. Iliada | $2,900 | Piel de res |
| Wash Off Brandy Est. Syrelle | $2,900 | Piel de res |
| Cavalier Choco Est. Nicole | $2,900 | Piel de res |
| Lizard Negro Bronce Cincelado Flores | $2,900 | Lizard |
| Alaska Orix Est. Amara | $2,900 | Piel de res |
| Zale Black Cherry Est. Iralia | $2,900 | Piel de res |
| Cavalier Cafe Est. Athala | $3,000 | Piel de res |
| Snake Black Est. Retro | $3,000 | Piel de res |
| Cavalier Negro Est. Athala | $2,900 | Piel de res |
| Wash Off Negro Est. Marie | $2,900 | Piel de res |
| Lizard Negro Bronce Est. Flores | $2,900 | Lizard |
| Cabra Cafe Kira | $3,300 | Piel de cabra |
| Grisly Rojo Est. Nicole | $2,900 | Piel de res |

### Reglas de Venta (8)

- Envios a todo Mexico (3-5 dias habiles)
- Envio gratis en compras >$2,500 MXN
- PayPal, Mercado Pago, transferencia
- 6 MSI en compras >$2,000 MXN
- Recommendar media talla menor
- Fabricantes artesanales de Leon
- Horario: L-V 9-18, Sab 9-14
- Precios de mayoreo por WhatsApp

### Instrucciones IA (5)

1. Mencionar fabricantes artesanales de Leon (prioridad 10)
2. Recomendar media talla menor (prioridad 10)
3. Destacar calidad de materiales (prioridad 8)
4. Dirigir mayoreo a WhatsApp (prioridad 7)
5. No hacer descuentos sin autorizacion (prioridad 9)
