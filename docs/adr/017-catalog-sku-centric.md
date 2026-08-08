# ADR-017: Catálogo SKU-Centric (Rediseño QuickSell)

## Status

Accepted

## Date

2026-08-08

## Council

Architect, Database Engineer, Backend Engineer, Frontend Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

Tras ADR-014 (media condicional) y ADR-016 (media por producto), el panel administra productos y multimedia en **tres silos desconectados**:

1. **Productos** (`/dashboard/assistants/[id]/products`): CRUD business-scoped pero solo accesible desde la ficha de un asistente; sin columna `sku`.
2. **MediaLibrary** (`/dashboard/knowledge` → tab "Biblioteca Multimedia"): grid plano con selector de producto.
3. **KnowledgeManager** (tab "Base de Conocimiento"): campos de imagen + trigger que duplican la media (tercer silo).

El problema no es de datos (el runtime ya escopa por `product_id`), sino de **jerarquía de UI**: los productos — el ancla del catálogo — no tienen un lugar propio a nivel negocio, y los medios genéricos y por-producto se mezclan en un solo grid.

Inspiración: QuickSell — un **hub SKU-centric** donde el producto es el contenedor y su multimedia cuelga de él.

---

## 2. Decision

**Crear un hub de catálogo a nivel negocio (`/dashboard/catalog`) donde la tarjeta de producto es el contenedor principal; añadir `products.sku`; filtrar el GET de items por `product_id`; y convertir `MediaLibrary` en "medios generales" (product_id IS NULL), eliminando el silo de imagen+trigger del KnowledgeManager.**

### 2.1 Sin sobreingeniería (acotado por el Concilio)

- **No** tablas nuevas (solo columna `sku`).
- **No** drag & drop, tags de media, categorías de media ni búsqueda multi-producto.
- **No** cambios de comportamiento AI/runtime.

---

## 3. Decisiones de diseño

### 3.1 Esquema (migración `030_catalog_sku.sql`)

| Cambio | Detalle |
|--------|---------|
| `products.sku TEXT NULL` | Identificador de inventario opcional |
| `CREATE UNIQUE INDEX products(business_id, sku) WHERE sku IS NOT NULL` | Unicidad por negocio solo cuando hay SKU; no rompe filas existentes ni obliga a migrar |

El `sku` es opcional para no añadir fricción en onboarding/carga manual. El índice parcial garantiza unicidad sin afectar los `NULL`.

### 3.2 API (`/api/knowledge/items`)

- GET acepta `product_id`: UUID (medio de ese producto) o `null` (medios genéricos).
- Validación estricta de UUID; `product_id` inválido → 400.
- El POST/PATCH conserva la regla existente: imagen requiere `trigger_condition` **o** `product_id`.

### 3.3 Hub de catálogo

- **Página** `/dashboard/catalog` (Server Component): carga productos del negocio + conteo/thumbnail de media por producto (query única sobre `knowledge_items` con imagen).
- **Grid** (`CatalogGrid`): tarjetas estilo QuickSell — thumbnail, nombre, badge SKU, precio, contador de medios, eliminar, y botón "Nuevo producto".
- **Ficha** `/dashboard/catalog/[id]` (Server Component) → `ProductDetail` (2 columnas): izquierda formulario/info del producto; derecha `ProductMedia`.
- **Formulario** (`ProductFormDialog`): título, **SKU**, precio, descripción, beneficios.
- **Sidebar**: nuevo item "Catálogo" en el grupo Aprende (4 diccionarios i18n + ruta en `AtmosphereProvider`).
- **Redirect**: `/dashboard/assistants/[id]/products` → `/dashboard/catalog` (compatibilidad de enlaces antiguos) y botón "Catálogo" en `AssistantConfig`.

### 3.4 Multimedia unificada

- `MediaUpload`, `MediaGrid`, `MediaEditDialog` extraídos como componentes reutilizables.
- `MediaBrowser` = contenedor único que resuelve el scope: `productId` presente → media del producto (trigger opcional); ausente → "medios generales" (`product_id IS NULL`, trigger requerido).
- `MediaLibrary` → wrapper de "medios generales" (el selector de producto desaparece; la media por producto se gestiona en la ficha del producto).
- `ProductMedia` → wrapper del scope por producto.
- **KnowledgeManager/KnowledgeItemDialog**: se eliminan los campos imagen + trigger de creación/edición (el silo). La media existente en la DB no se migra: el runtime sigue enviándola; solo la UI de creación deja de ofrecerla.

---

## 4. Consecuencias

### Positivas

- Jerarquía clara: el producto es el contenedor; su multimedia cuelga de él.
- Un solo lugar para crear medias por producto; un solo lugar para genéricos.
- `sku` disponible para el negocio (identificador de inventario) sin romper datos existentes.
- API extendida de forma backward compatible.
- Sin coste AI adicional (sin cambios de runtime).

### Negativas / Trade-offs

- Los medios por producto ya existentes dejan de verse en la biblioteca general (se ven en la ficha del producto).
- KnowledgeManager ya no permite adjuntar imagen a un ítem de conocimiento (decisión explícita; la media vive en catálogo/biblioteca).
- El `product_id` quedó pendiente de aplicar en la DB (migración 029 no aplicada en entorno de trabajo a la fecha).

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Mantener los tres silos y solo añadir sku** | No resuelve la jerarquía; el usuario sigue gestionando productos fuera de su contexto |
| **Detalle de producto inline expandible en el grid** | Complejidad de estado y layout; una ruta dedicada es más simple y navegable |
| **Catálogo assistant-scoped (bajo la ficha del asistente)** | Productos son business-scoped (columna `business_id`, no `assistant_id`); exponerlos a nivel negocio refleja el modelo |
| **Migrar los medios con imagen de KnowledgeManager a catalog** | Destruiría el vínculo con ítems de conocimiento existentes; mantenerlos como dato legado es más seguro |

---

## 6. Referencias

- `supabase/migrations/030_catalog_sku.sql` — columna `sku` + índice único parcial
- `src/app/dashboard/catalog/page.tsx`, `src/app/dashboard/catalog/[id]/page.tsx` — páginas del hub
- `src/components/catalog/` — `CatalogGrid`, `ProductCard`, `ProductFormDialog`, `ProductDetail`, `ProductMedia`
- `src/components/knowledge/MediaBrowser.tsx` (+ `MediaUpload`, `MediaGrid`, `MediaEditDialog`) — multimedia unificada con scope
- `src/components/knowledge/MediaLibrary.tsx` — "medios generales" (`product_id IS NULL`)
- `src/components/knowledge/KnowledgeManager.tsx`, `KnowledgeItemDialog.tsx` — sin campos imagen/trigger
- `src/app/api/knowledge/items/route.ts` — filtro `product_id` (tests en `tests/api/knowledge-items.test.ts`)
- `src/components/dashboard/Sidebar.tsx`, `src/lib/i18n/dictionaries/*.ts`, `src/components/dashboard/AtmosphereProvider.tsx` — navegación
- `src/app/dashboard/assistants/[id]/products/page.tsx` — redirect a `/dashboard/catalog`
