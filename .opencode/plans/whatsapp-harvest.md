# Cosecha del histórico real de WhatsApp — registro de ejecución

> **Estado: ejecutado.** Este documento ya no es un plan: es el registro de lo que
> realmente se hizo, con el esquema real y las cifras reales. Sustituye al plan
> original, que predecía un esquema (`wtsexporter`/JSON) y herramientas
> (`wabdd`) que resultaron innecesarios.

Negocio `4fb7418d-6c98-4a09-9094-4e4e4b2006a6` · canal `whatsapp` (número redactado;
está en la tabla `channels` de Vitanova).

---

## 1. Por qué crypt15

| Formato | Clave | ¿Root? |
|---|---|---|
| `crypt14` | `/data/data/com.whatsapp/files/key` | **Sí — inviable** |
| `crypt15` (E2E) | clave de 64 dígitos que WhatsApp muestra en pantalla | **No** |

`crypt15` vive en Google Drive, así que se baja sin tocar el teléfono. Es la única
vía automática sin root.

## 2. Lo que realmente traía el respaldo

Ninguna herramienta externa hizo falta: el respaldo es un `.zip` con
`Databases/msgstore.db` en formato **WhatsApp Android v2**, que se abre en SQLite
normal. No hay protobuf que parsear.

| Hecho | Detalle |
|---|---|
| Tabla de mensajes | `message` (singular), no `messages` |
| Texto | `message.text_data` |
| `message_text` | solo *previews* de multimedia, no el cuerpo del mensaje |
| Instantes | **milisegundos** epoch |
| Identidad | `key_remote_jid` → `jid_map` resuelve `@lid` a teléfono real |
| Ruido | `message_type=7` = mensaje de sistema (~2.745 filas) |
| Texto conversacional | 3.218 de 5.963 mensajes |
| Rango total | 2026-01-28 → 2026-10-02 |

**No existe texto conversacional oculto.** Las únicas captions útiles eran cuatro
mensajes de Delivery. Se descartó partir en grupos: incluyen logística interna y
`borradores mia`.

## 3. Qué se importó

Filtro: solo 1:1, solo anterior a `2026-08-04`, solo con teléfono resoluble.

| | |
|---|---|
| Mensajes | **638** |
| Teléfonos | 63 |
| Rango útil | 2026-05-28 → 2026-08-01 |
| Insertados / fallidos | 638 / 0 |
| Filas de grupo | **0** |
| `customer_id` informado | **0** (siempre `NULL`) |

Restricciones respetadas: nunca se invocó `processIncomingMessage`, nunca se
escribió en `customers`, el puente y el modo `shadow` quedaron intactos.

## 4. Etiquetado de autor

Fue el punto más delicado: la clasificación inicial por estilo confundió parte de
la salida de MIA con mensajes de la vendedora, porque MIA no lleva emoji ni
erratas. Entrenar con eso habría sido retroalimentar al modelo con su propia salida.

Se resolvió con **dos detectores en unión, con precedencia**:

```
entrante > interno > bug booleano > señal determinista de MIA > clasificador de estilo
```

Señales deterministas: asteriscos de markdown (`*Clean Nails*`), frases de
plantilla (`Con gusto te ayudo.` con "te" y mayúscula), testimonio inventado
(`Este cliente lleva…`), y la fórmula de traspaso `he conectado tu solicitud con
nuestro equipo`. Se excluyeron a propósito los aperturas humano-normales
(`hola!!`, `claro!!`) que una heurística por estilo confunde.

**Correciones: 47 `human → bot` y 6 `human → internal`. Ninguna inversa.**

El chat resultó ser del propio equipo — dos mensajes sobre el comportamiento del
asistente — y no de un cliente: nunca debe entrenarse. El número está redactado
aquí a propósito y vive en `HARVEST_INTERNAL_JIDS`; el texto de esos mensajes
tampoco se reproduce, porque es correspondencia privada.

| Autor | Mensajes |
|---|---|
| Cliente | 216 |
| Vendedora | 133 |
| Bot | 281 |
| Internos | 6 |
| Bot con bug (`true`/`false`) | 2 |

Cada fila guarda `author_label`, `author_label_style` y `author_label_reason`,
así que la decisión es auditable y reversible.

## 5. Aprendizajes extraídos

15 `learning_events` insertados en `pending` — no se auto-aplican. Cada uno lleva
la evidencia en `knowledge_change`.

| Severidad | Nº | |
|---|---|---|
| critical | 4 | testimonios inventados, fuga de instrucciones internas, bucle de menú, precio |
| high | 5 | seguimiento automático, afirmaciones sin respaldo, honestidad, incertidumbre, leer la foto |
| medium | 5 | pack único, rachas largas, una frase por duda, reencuadrar, cierre concreto |
| low | 1 | reírse del propio bot |

### Corrección registrada

El aprendizaje `un_precio_por_producto` se insertó afirmando que Clean Nails
cotizaba a `$499/$799` frente a `$550` y que había que corregir el catálogo.
**Era falso, por dos errores de análisis:**

1. Se mezclaron productos: el filtro cruzaba el nombre del producto con cualquier
   precio de la misma cadena, así que el `$499` de Neurofeet se contabilizó como
   precio de Clean Nails.
2. `$499/$799` (2–3 jun) y `$550` (25–26 jul) son **el mismo producto antes y
   después de un cambio de precio legítimo**. El catálogo (`550`) es correcto.

Se corrigió el registro conservando la anotación del error. El problema real que
sí quedó demostrado: el catálogo admite **un** precio por producto, pero hay
productos vendidos en varios tamaños (Bye Canas `$399` medio litro / `$550` litro;
Neurofeet 3 y 4 pares), y hay confirmaciones de pedido que citan
`Diabetic patch`, que no existe en el catálogo, con `Cantidad: 36`.

## 6. Código

```
src/lib/import/conversations/
  types.ts      esquema zod; invariante customerId: z.literal(null)
  index.ts      preview | import, lotes de 200, precheck de IDs, fallback por fila
tests/import/conversations.test.ts   10 pruebas
scripts/import-harvest-conversations.ts
scripts/fix-harvest-author-labels.ts     clasificador autoritativo de autor
scripts/analyze-harvest-failures.ts      fallos del bot vs técnicas humanas
scripts/check-catalogue-consistency.ts   catálogo vs precios citados
scripts/verify-harvest-import.ts
```

Troceado adaptativo de `.in()` a ~3.000 caracteres: el filtro por `external_id`
excedía el límite de cabeceras y devolvía `UND_ERR_HEADERS_OVERFLOW`.

## 7. Calidad

| Comprobación | Resultado |
|---|---|
| `npm run lint` | 0 errores, 23 warnings preexistentes |
| `npm run build` | correcto |
| `tests/import/conversations.test.ts` | 10/10 |
| `npx tsc --noEmit` | 48 errores, **todos preexistentes** en `tests/unit/reasoning/`, `tests/sales/`…; 0 en código nuevo |

`docs/analysis/` está en `.gitignore`: contiene teléfonos y mensajes reales.

## 8. Pendiente

### Hecho

- Eliminados los 44,8 MB / 276 archivos de `Temp\opencode\wa`: clave E2E, tokens de
  OAuth, respaldo descifrado y todo el material personal que contenía (fotos,
  notas de voz, PDF de precios, hojas de reparto).
- `docs/analysis/` añadido a `.gitignore`.
- Aprendizaje de precio corregido tras descubrir el falso positivo.
- Plan reescrito como registro de ejecución (este documento).

### Solo puede hacerlo el usuario

1. **Rotar la clave E2E de WhatsApp.** Requiere el teléfono
   (Ajustes → Chats → Copia de seguridad → *Usar clave de cifrado de 64 dígitos*).
   Borrar el archivo local **no** invalida la clave: sin cambiar la clave en el
   teléfono, el respaldo antiguo sigue descifrándose con ella.
2. **Revocar el acceso de Google.** En `myaccount.google.com` → Seguridad →
   *Tus conexiones con terceros*, quitar la aplicación a la que se dio acceso a Drive.
   Borrar el token local no revoca el permiso en el lado de Google.

### Pendiente de código

3. **Variantes de producto**: añadir tamaño/presentación al catálogo para que el
   importe del pedido sea derivable y no escrito a mano.
4. Investigar `Diabetic patch` (pedido sin producto en catálogo) y la confirmación
   con `Cantidad: 36`. El respaldo del teléfono contenía un
   `LISTA DE PRECIOS 2026.pdf` que ya no está en disco; conviene recuperar una
   copia antes de decidir precios.
5. Aprobar o rechazar los 15 `learning_events` uno por uno.
6. No reconectar el puente hasta que los 4 críticos estén resueltos.

## 9. Lo que no se hizo

- No se modificó el puente, ni el modo `shadow`, ni el runtime.
- No se escribió en `customers`, `sales_events` ni órdenes.
- No se tocó Inventario ni Delivery.
- No se aprueban aprendizajes automáticamente (ADR-010).