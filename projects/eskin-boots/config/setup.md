# Eskin Boots - Configuracion MIA

## Datos del Negocio

- **Nombre:** Eskin Boots
- **Ubicacion:** Leon, Guanajuato, Mexico
- **Web:** ekeskin.shop
- **WhatsApp:** 477-188-9518
- **Tipo:** Fabricante artesanal de calzado de piel genuina

## Productos

- **18 modelos** de botas de piel genuina
- **Rango de precios:** $2,900 - $3,300 MXN
- **Materiales:** Piel de res, piel de cabra, lizard
- **Estilos:** Western, casual, elegante

## Reglas de Venta

| Categoria | Regla |
|-----------|-------|
| Envios | Todo Mexico, 3-5 dias habiles. Envio gratis >$2,500 MXN |
| Pagos | PayPal, Mercado Pago, transferencia. 6 MSI >$2,000 MXN |
| Tallas | SIEMPRE recomendar media talla menor |
| Mayoreo | WhatsApp 477-188-9518 para precios especiales |

## Personalidad del Asistente

- **Nombre:** Eskin
- **Estilo:** Asesora experta
- **Calidez:** 60/100
- **Formalidad:** 60/100
- **Humor:** 30/100
- **Agresividad de ventas:** 60/100

## Instrucciones IA

1. Siempre mencionar que somos fabricantes artesanales de Leon
2. Recomendar media talla menor en todas las consultas de talla
3. Destacar calidad de materiales y diseno artesanal
4. Para mayoreo, dirigir a WhatsApp 477-188-9518
5. No hacer descuentos sin autorizacion

## Canales

- **Web:** Chat en ekeskin.shop (widget embeddable) ✅
- **WhatsApp:** API de WhatsApp Business ✅ (listo para configurar)

## Widget Embeddable (Sprint 2)

Para agregar el chat a ekeskin.shop, agregar este snippet antes de `</body>`:

```html
<script
  src="https://tu-dominio.com/widget.js"
  data-assistant-id="UUID-DEL-ASSISTANT"
  data-name="Eskin"
  data-position="bottom-right"
  data-color="#7c3aed"
  data-width="380px"
  data-height="520px"
></script>
```

### Parametros

| Parametro | Requerido | Default | Descripcion |
|-----------|-----------|---------|-------------|
| `data-assistant-id` | Si | - | UUID del assistant de Eskin Boots |
| `data-name` | No | MIA | Nombre del asistente |
| `data-position` | No | bottom-right | Posicion: bottom-right, bottom-left |
| `data-color` | No | #7c3aed | Color del boton flotante |
| `data-width` | No | 380px | Ancho del widget |
| `data-height` | No | 520px | Alto del widget |

### URLs del Widget

- **Widget page:** `/widget?assistantId=UUID&name=Eskin`
- **Widget API:** `/api/widget/chat` (POST, sin auth)

### Limites

- 30 mensajes por sesion (por hora)
- Sin autenticacion requerida (publico)
- CORS habilitado para cualquier origen

## Documentacion

- `seed/eskin-boots-data.ts` - Datos completos del seed
- `config/setup.md` - Este archivo

## Seed (Cargar datos)

### Opcion 1: API Route

```bash
curl -X POST http://localhost:3000/api/seed
```

### Opcion 2: CLI Script

```bash
npx tsx scripts/seed-eskin-boots.ts
```

### Datos que crea

| Entidad | Cantidad |
|---------|----------|
| Business | 1 |
| Brand Identity | 1 |
| Assistant | 1 |
| Products | 18 |
| Sales Rules | 8 |
| AI Instructions | 5 |
