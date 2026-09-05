# AgenteInventarioDyko

Módulo de inventario para **Dyko**: stock, vencimientos (FEFO), rotación ABC, plan de compras y promociones, con el agente **DARA** (Grok + herramientas).

Repo **privado**. Moneda: colones (CRC). UI en español.

## Qué copiar a Dyko

El cerebro no depende de la UI. Empieza por estos archivos:

| Pieza | Ruta | Qué hace |
|---|---|---|
| Tipos | `src/lib/inventory/types.ts` | Producto, lote, categoría, estados |
| Motor | `src/lib/inventory/analytics.ts` | Stock saludable, ABC, pedir / no pedir, promos, alertas |
| Fechas / ₡ | `src/lib/inventory/format.ts` | Formato CR |
| Demo | `src/lib/inventory/seed.ts` | Catálogo de ejemplo (cámbialo por el de Dyko) |
| Estado | `src/lib/inventory/store.ts` | Zustand en memoria |
| Agente | `src/lib/agent/ask.ts` | DARA: tools + Grok (`grok-4.5`) |
| Chat | `src/components/agent/agent-panel.tsx` | Panel del agente |

Pantallas: `src/routes/inventario.tsx`, `vencimientos.tsx`, `rotacion.tsx`, `compras.tsx`, `promociones.tsx`, `index.tsx`.

## Cómo implantarlo en Dyko

1. **Conecta el inventario real**  
   Sustituye `buildCatalog()` por lecturas de tu base (productos, lotes, ventas 90 días).  
   El agente no lee la base directo: recibe un `CatalogSnapshot[]` (SKU, stock, lotes, ventas 7/30/90).  
   Mapea tus tablas a ese snapshot y DARA sigue igual.

2. **Motor de reglas (sin IA)**  
   `analyzeCatalog(products)` ya calcula:
   - stock objetivo
   - cobertura en días
   - clase ABC y velocidad
   - **pedir / urgente / no pedir**
   - **promoción** (vence o rotación muerta)

3. **DARA (IA)**  
   En el servidor, con `XAI_API_KEY` (nunca en el cliente):
   - `askInventoryAgent({ messages, catalog })`
   - Tools: `overview`, `list_products`, `product_detail`, `expiries`, `purchase_plan`, `promo_plan`, `healthy_stock`
   Si Dyko no usa TanStack Start, copia el `handler` de `ask.ts` a tu API (Express, Nest, Laravel, etc.) y deja el `fetch` a `https://api.x.ai/v1/chat/completions`.

4. **UI**  
   React 19 + Tailwind v4 + Radix. Si Dyko ya tiene design system, reusa solo el motor y el agente; las pantallas son referencia.

## Dependencias

`zustand`, `lucide-react`, `date-fns`, `recharts`, `@tanstack/react-router`, `@tanstack/react-start`, `tailwindcss`, Radix (dialog, tooltip, separator, scroll-area), `class-variance-authority`, `clsx`, `tailwind-merge`.

El agente **no** llama a la API al cargar la página: solo cuando el usuario pregunta.
