# AgenteInventarioDyko · InventarioIA + MermaIA

Agentes de **Dyko Intelligence**. Analistas de bodega: rotación, margen, vencimientos, compras y merma vs conteo físico.

**No ejecutan nada.** No emiten OC, no aplican descuentos, no ajustan existencias. Proponen; el humano aprueba.

Repo **privado**. Moneda: colones (CRC). Idioma: español.

Demo: bodega Puntarenas. Empresa y sucursal son **parámetro de tenant** (engranaje en el header), no constantes de código.

## InventarioIA

1. Stock fuera de banda (quiebre o sobre-stock).
2. Vencimientos crítico / alerta / vigilar (editables). Margen mínimo editable (default 25%).
3. Compra: `cantidad = rotación diaria × (lead + seguridad) − stock`.
4. Clases: `comprar_ya` | `comprar_pronto` | `no_comprar` | `descontinuar` | `vigilar`.
5. JSON + resumen.

Modos: `rapido` · `cuidadoso` · `verificado`.

## MermaIA (módulo hermano)

Compara `stock teórico` con `conteo físico`. No inventa conteos.

Clases: `cuadrado` | `merma_operativa` | `posible_hurto` | `error_probable_conteo` | `sobrante` | `merma_no_clasificada` | `sin_conteo`.

`posible_hurto` es hipótesis, no sentencia.

## Catálogo grande (no recortar en silencio)

El agente **no** toma los primeros 80 SKU. Analiza hasta `AGENT_CATALOG_CAP` (400), priorizando quiebre, vencimiento y sobre-stock. Si el catálogo es mayor, lo declara en `datos_faltantes_o_incertidumbre`. Nunca asume el resto.

`sales30Prev` / `sales30Old` son `number | null`. Si Dyko no los manda, la tendencia es `sin_dato` — no “estable”.

Bundles solo con la **misma categoría** o el mapa `COMPLEMENT_CATEGORIES` (snacks↔bebidas, etc.).

El LLM reintenta 3 veces con backoff. Respaldo: `LLM_PROVIDER=openai` + `LLM_API_KEY` (y opcional `LLM_BASE_URL` / `LLM_MODEL`). Si xAI cae y hay clave de respaldo, usa el otro.

## Implantar en Dyko

1. Mapea productos, lotes FEFO, ventas 90 días y lead time a `CatalogSnapshot`.
2. `analyzeCatalog` / `analyzeSnapshots` — métricas **sin IA**.
3. `buildReport(metrics, modo)` → JSON InventarioIA (`SPEC.md`).
4. Conteos a `PhysicalCount`. `analyzeShrinkage` / `buildShrinkageReport` (`SPEC-MERMA.md`).
5. `askInventoryAgent` con `domain`, `params`, `tenant`. `XAI_API_KEY` solo en servidor.

Dependencias: ver `package.json` (peer: React 19, zustand, TanStack). Typecheck: `tsconfig.json`.

## Archivos clave

| Pieza | Ruta |
|---|---|
| Tipos / params / tenant | `src/lib/inventory/types.ts` |
| Motor inventario | `src/lib/inventory/analytics.ts` |
| Prioridad de catálogo | `src/lib/inventory/select.ts` |
| Tipos MermaIA | `src/lib/shrinkage/types.ts` |
| Motor merma | `src/lib/shrinkage/analytics.ts` |
| Agente + retry LLM | `src/lib/agent/ask.ts` |
| Config negocio | `src/components/inventory/settings-sheet.tsx` |
| Contratos | `SPEC.md` · `SPEC-MERMA.md` |

## Roadmap (no incluido)

Canasta, precio por elasticidad, forecast estacional, simulador de caja/bodega, alertas de proveedor.
