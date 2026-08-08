# ADR-018: Motor de Importación Multipropósito para el Hub de Catálogo

## Status

Accepted

## Date

2026-08-08

## Council

Architect, Backend Engineer, Frontend Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

Tras ADR-017 (catálogo SKU-centric), el negocio puede cargar productos manualmente uno a uno desde `/dashboard/catalog`. Para un inventario real (decenas o cientos de SKUs), la carga manual es inviable. El negocio necesita **poblar el catálogo en segundos** desde las fuentes que ya usa:

1. **Archivos**: hojas de cálculo CSV/XLSX exportadas de su inventario (Excel, Google Sheets, ERPs legados).
2. **Tienda en línea**: WooCommerce (Store API pública o REST autenticada con credenciales).
3. **Feed**: catálogos RSS/Atom/XML genérico (Google Shopping, proveedores, marketplaces).
4. **Web**: HTML estático con tarjetas de producto detectables heurísticamente.

Cada fuente expone los mismos campos destino (`name`, `sku`, `price`, `description`, `benefits`, `imageUrl`) con nombres y formatos distintos. Sin un motor común, cada adaptador duplicaría la normalización, validación y escritura.

Dos restricciones de dominio aplican: la columna `stock` de un archivo se acepta pero se **descarta** (inventario fuera del dominio de ventas, ADR-010), y la escritura debe respetar la unicidad `business_id + sku` definida en ADR-017.

---

## 2. Decision

**Crear un motor de importación centralizado en `src/lib/import/` con pipeline único `fetch → parse → normalize → validate → upsert → summary`, dos endpoints (`POST /api/catalog/import/file` y `POST /api/catalog/import/source`), y un diálogo de importación en `/dashboard/catalog` con tres pestañas (archivo, conectar tienda, scraping web).**

### 2.1 Sin sobreingeniería (acotado por el Concilio)

- **No** schema change: se reutiliza la tabla `products` y el índice `(business_id, sku)` existentes.
- **No** colas ni workers: límite de **500 filas por request** (`MAX_IMPORT_ROWS`), suficiente para el onboarding.
- **No** persistencia de credenciales de WooCommerce: viven solo en memoria del request.
- **No** manejo de stock ni sincronización programada.

---

## 3. Decisiones de diseño

### 3.1 Pipeline

| Etapa | Responsabilidad | Ubicación |
|-------|-----------------|-----------|
| Fetch | Descarga segura del origen (SSRF-safe) | `src/lib/import/sourceClient.ts`, `ssrf.ts` |
| Parse | Convierte el origen en `RawRow[]` | `parsers.ts` (CSV/XLSX), `feed.ts` (XML), `scraper.ts` (HTML), `woocommerce.ts` |
| Normalize | Header auto-mapping multilingüe (archivo) y tipos comunes | `validators.ts` (`normalizeRows`, `parsePrice`) |
| Validate | Zod por fila; fila inválida → error con número de fila | `validators.ts` |
| Upsert | INSERT/UPDATE por `business_id + sku` con admin client | `engine.ts` (`upsertRows`) |
| Summary | Resumen por fila (created/updated/skipped/failed/stockDropped) | `types.ts`, `engine.ts` |

### 3.2 Modelo de datos compartido

- `RawRow`: forma neutral de una fila (`name`, `sku`, `price`, `description`, `benefits`, `imageUrl`, `stock`).
- `NormalizedRow`: fila validada y tipada (price como número, textos limpios).
- `ImportSummary`: `created`, `updated`, `skipped`, `errors[]`, `stockDropped`, `total`; el total se calcula sobre el resultado final.
- `PreviewResult`: `rows` (máx 20), `total`, `skipped`, `errors`, `stockDropped`, `method`, `source`.

### 3.3 Arquitectura de seguridad

- **SSRF guard** (`ssrf.ts`): solo `http/https`, bloqueo de IPs privadas/loopback/`169.254.169.254` (metadata cloud), `lookup` DNS re-validado por IP, redirects re-validados (`fetchWithRedirectSafety`), timeout 10s, respuesta máxima 5 MB, y `detectContentType` para validar el tipo real del origen.
- **Archivos** (`file/route.ts`): validación de extensión (.csv/.xlsx), MIME permitido, tamaño ≤ 5 MB, **magic bytes** (firma ZIP para XLSX, detector de binario para CSV) y sanitización de **fórmulas** (celdas que inician con `=`, `+`, `-`, `@` → texto).
- **Escritura**: owner check del `business_id` antes de upsert; writes con `createAdminClient()` (evita RLS 42501, ver AGENTS.md §5.5).
- **Credenciales**: consumer_key/secret solo en memoria del request, nunca en logs ni DB.

### 3.4 Adaptadores de origen

| Origen | Extracción | Detalles |
|--------|-----------|----------|
| **WooCommerce** | API pública `wc/store/v1/products` o REST `wc/v3/products` con credenciales | Paginado `per_page=100` máx 5 páginas vía `X-WP-TotalPages`; campos: `name`, `sku`, `prices.price`, `short_description`, `description`, `images[0].src` |
| **Feed** | `fast-xml-parser` | RSS (namespaces `g:`/`media:`/`woocommerce:`), Atom (`link rel="enclosure"`), XML genérico (`<products><product>`, `<catalog><item>`, etc.); precios limpiados de símbolos |
| **Scraping** | Cheerio | `detectCardSelector` por heurística (clases `product/card/item/tile/listing/producto`), scoring por precio y **exclusión de contenedores anidados** (un elemento que envuelve otra tarjeta con precio no cuenta); selector CSS explícito opcional; `srcset` prioriza mayor resolución |

### 3.5 Endpoints

- **`POST /api/catalog/import/file`**: multipart (`business_id`, `file`). Errores 400 (formato/tamaño/mime), 401, 403, 422 (sin filas válidas). `rowBase=2` (los headers son la fila 1).
- **`POST /api/catalog/import/source`**: JSON (`business_id`, `method`, `url`, `mode: preview|import`, `credentials?`, `selectors?`). Errores 400 (zod), 401, 403, 422 (sin productos), 502 (fallo de fetch). `rowBase=1` (fuentes remotas no tienen header row). Preview limita a 20 filas.

### 3.6 UI

- `ImportDialog`: tres pestañas — **Archivo** (upload directo), **Conectar tienda** (URL + credenciales opcionales + selector CSS opcional + preview), **Scraping web**.
- `SourceImportPanel`: flujo URL → preview (`PreviewTable`) → confirmar importación → `ImportResults`.
- `CatalogGrid`: botón "Importar" que abre el diálogo; `handleImported` re-consulta productos + media para refrescar el grid.

### 3.7 Stock fuera del dominio

El parser de archivos detecta la columna `stock` y la **descarta** (no se inserta), informándolo en el resumen como `stockDropped` con `stockColumnPresent: true`. La tabla `products` no tiene columna de inventario (ADR-010).

---

## 4. Consecuencias

### Positivas

- Un solo pipeline para cuatro orígenes: extensible (basta añadir un adaptador `fetchX → RawRow[]`).
- Resumen por fila con número de línea: el usuario sabe exactamente qué falló y dónde.
- Seguridad integrada: SSRF, magic bytes, fórmula-injection y RLS evadidos por diseño.
- Sin coste AI adicional: cero llamadas OpenAI en el flujo.
- `sku` es el identificador de ida y vuelta con el inventario del negocio (ADR-017).

### Negativas / Trade-offs

- Límite de 500 filas: catálogos muy grandes requieren importaciones parciales (decisión deliberada, sin colas).
- El scraping heurístico depende de la estructura del sitio; el selector CSS explícito es la vía de escape.
- La columna `stock` del archivo se descarta silenciosamente en el resumen (por diseño, ADR-010).
- El preview solo aplica a fuentes remotas; un archivo se importa directamente tras validación.

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **SheetJS para XLSX** | Se prefirió `read-excel-file` (menor superficie, sin evaluación dinámica de fórmulas; las fórmulas se leen como texto y se sanitizan) |
| **Colas / background jobs para importación** | Complejidad operativa no justificada para el onboarding; 500 filas caben en un request síncrono |
| **Persistir credenciales de WooCommerce en DB** | Riesgo de seguridad y necesidad de cifrado/gestión de secretos; los request en memoria son más simples |
| **Reutilizar el supabase server client para writes** | Violaría la regla RLS 42501 (ver AGENTS.md §5.5); el admin client es el patrón establecido |
| **Detectar tarjetas por selector más simple (solo clase `product`)** | Produce falsos positivos de contenedores y títulos anidados; el scoring con exclusión de contenedores anidados es más robusto |

---

## 6. Referencias

- `src/lib/import/` — `types.ts`, `ssrf.ts`, `validators.ts`, `parsers.ts`, `feed.ts`, `scraper.ts`, `woocommerce.ts`, `sourceClient.ts`, `engine.ts`
- `src/app/api/catalog/import/file/route.ts`, `src/app/api/catalog/import/source/route.ts` — endpoints
- `src/components/catalog/import/` — `ImportDialog`, `FileImportPanel`, `SourceImportPanel`, `PreviewTable`, `ImportResults`
- `src/components/catalog/CatalogGrid.tsx` — botón Importar + refresco post-importación
- `tests/import/` — suite unitaria del motor (parsers, validators, ssrf, scraper, feed, woocommerce, sourceClient, engine)
- `tests/api/catalog-import-file.test.ts`, `tests/api/catalog-import-source.test.ts` — tests de endpoints
- ADR-010 (dominio de ventas, exclusión de inventario) y ADR-017 (SKU como identificador del catálogo)
