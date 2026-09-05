# AgenteInventarioDyko · InventarioIA + MermaIA

Agentes de **Dyko Intelligence**. Analistas de bodega: rotación, margen, vencimientos, compras y merma vs conteo físico.

**No ejecutan nada.** No emiten OC, no aplican descuentos, no ajustan existencias. Proponen; el humano aprueba.

Repo **privado**. Moneda: colones (CRC). Idioma: español.

Demo: bodega Puntarenas. El motor es agnóstico al vertical: InventarioIA necesita `CatalogSnapshot`; MermaIA necesita además `PhysicalCount[]`.

## InventarioIA

1. Detecta el 100% de SKU fuera de banda (quiebre inminente o sobre-stock).
2. Vencimientos **crítico ≤7 / alerta ≤30 / vigilar ≤60** con descuento, bundle o liquidación que respeta **margen mínimo 25%**, salvo pérdida controlada justificada.
3. Sugerencia de compra: `cantidad = rotación diaria × (lead time + stock de seguridad) − stock actual`.
4. Clasifica cada SKU: `comprar_ya` | `comprar_pronto` | `no_comprar` | `descontinuar` | `vigilar`.
5. Entrega **JSON para Dyko** + resumen en lenguaje natural.

### Modos

| Modo | Uso | Comportamiento |
|---|---|---|
| `rapido` | Corrida diaria | Solo quiebre inminente y vencimiento ≤7 d |
| `cuidadoso` | Revisión semanal (default) | Reporte completo |
| `verificado` | Compra grande | Compara ventanas 30 d vs 90 d |

## MermaIA (módulo hermano)

Compara `stock teórico` con `conteo físico`. **No inventa conteos.** Si un SKU no está en el ciclo, es `sin_conteo` (dato faltante).

Clases: `cuadrado` | `merma_operativa` | `posible_hurto` | `error_probable_conteo` | `sobrante` | `merma_no_clasificada` | `sin_conteo`.

`posible_hurto` es hipótesis (faltante alto en no perecedero sin vencimiento), no sentencia. MermaIA no da de baja ni corrige el teórico: el click en Dyko es la aprobación.

Contrato: `SPEC-MERMA.md`.

## Implantar en Dyko

1. Mapea productos, lotes FEFO, ventas 90 días y lead time a `CatalogSnapshot` (`src/lib/inventory/types.ts`).
2. `analyzeCatalog` / `analyzeSnapshots` calculan métricas **sin IA** — deterministas, auditables.
3. `buildReport(metrics, modo)` produce el JSON de InventarioIA (`SPEC.md`).
4. Mapea conteos a `PhysicalCount`. `analyzeShrinkage(metrics, counts)` / `buildShrinkageReport` → JSON de MermaIA (`SPEC-MERMA.md`).
5. `askInventoryAgent` con `domain: "inventario" | "merma"`. Copia el handler de `src/lib/agent/ask.ts` a tu API. `XAI_API_KEY` solo en servidor.

Si falta un dato crítico, el reporte lo declara. **Nunca se inventa.**

## Archivos clave

| Pieza | Ruta |
|---|---|
| Tipos InventarioIA | `src/lib/inventory/types.ts` |
| Motor inventario | `src/lib/inventory/analytics.ts` |
| Tipos MermaIA | `src/lib/shrinkage/types.ts` |
| Motor merma vs conteo | `src/lib/shrinkage/analytics.ts` |
| Agente + tools (ambos) | `src/lib/agent/ask.ts` |
| Panel (InventarioIA \| MermaIA) | `src/components/agent/agent-panel.tsx` |
| Ruta merma | `src/routes/merma.tsx` |
| Contratos | `SPEC.md` · `SPEC-MERMA.md` |

## Datos que los agentes no asumen

Lotes en perecederos, ventas en 90 días, lead time observado, historial real de merma, cámaras, bitácora diaria. El calendario CR se anota como contexto; **no infla cantidades**.

## Roadmap (no incluido)

Canasta, precio por elasticidad, forecast estacional, simulador de caja/bodega, alertas de proveedor.
