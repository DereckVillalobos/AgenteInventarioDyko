# AgenteInventarioDyko · InventarioIA

Agente de inventario para **Dyko Intelligence**. Analista senior de rotación, margen, vencimientos y compras.

**No ejecuta nada.** No emite órdenes de compra ni aplica descuentos. Propone; el humano aprueba.

Repo **privado**. Moneda: colones (CRC). Idioma: español.

Demo: bodega Puntarenas. El motor es agnóstico al vertical (bodega, 3 Regalos, librería): solo necesita el `CatalogSnapshot`.

## Qué hace

1. Detecta el 100% de SKU fuera de banda (quiebre inminente o sobre-stock).
2. Vencimientos **crítico ≤7 / alerta ≤30 / vigilar ≤60** (configurable en `DEFAULT_PARAMS`) con descuento, bundle o liquidación que respeta **margen mínimo 25%**, salvo pérdida controlada justificada.
3. Sugerencia de compra: `cantidad = rotación diaria × (lead time + stock de seguridad) − stock actual`.
4. Clasifica cada SKU: `comprar_ya` | `comprar_pronto` | `no_comprar` | `descontinuar` | `vigilar`.
5. Entrega **JSON para Dyko** + resumen en lenguaje natural (<5 s de lectura).

## Modos

| Modo | Uso | Comportamiento |
|---|---|---|
| `rapido` | Corrida diaria | Solo quiebre inminente y vencimiento ≤7 d |
| `cuidadoso` | Revisión semanal (default) | Reporte completo |
| `verificado` | Compra grande | Compara ventanas 30 d vs 90 d (self-consistency) |

## Implantar en Dyko

1. Mapea productos, lotes FEFO, ventas 90 días (y si puedes, 30+30 anteriores) y lead time a `CatalogSnapshot` (`src/lib/inventory/types.ts`).
2. `analyzeCatalog` / `analyzeSnapshots` calculan métricas **sin IA** — deterministas, auditables.
3. `buildReport(metrics, modo)` produce el JSON del esquema Dyko.
4. `askInventoryAgent` es InventarioIA: llama tools sobre ese snapshot. Copia el `handler` de `src/lib/agent/ask.ts` a tu API. `XAI_API_KEY` solo en servidor.

Si falta un dato crítico (lotes, ventas, lead time, conteo físico), el reporte lo declara en `datos_faltantes_o_incertidumbre`. **Nunca se inventa.**

## Archivos clave

| Pieza | Ruta |
|---|---|
| Tipos, params, JSON | `src/lib/inventory/types.ts` |
| Motor (rotación, FEFO, margen, clasificación) | `src/lib/inventory/analytics.ts` |
| Tests de contrato | `src/lib/inventory/analytics.test.ts` |
| Agente + tools | `src/lib/agent/ask.ts` |
| Panel | `src/components/agent/agent-panel.tsx` |
| Contrato de salida | `SPEC.md` |

## Reglas de negocio (no negociables)

- Cantidad sugerida = `ceil(rotación_diaria × (lead + seguridad)) − stock`, acotada a `maxStock`.
- Quiebre inminente: días de cobertura < lead time del proveedor → `comprar_ya`.
- Sobre-stock: cobertura > 90 días → `no_comprar`.
- FEFO: si el lote a vencer cubre la demanda, `no_comprar`.
- Descuento máximo que preserva margen: `floor((1 − (costo / ((1 − margenMin) × precio))) × 100)`.
- Pérdida controlada **solo** por vencimiento inminente, marcada y con justificación.
- Cada línea trae el *porqué* (dato que la disparó).

## Datos que el agente no asume

Conteo físico (merma), historial real de proveedor/lead time observado, estacionalidad histórica de Dyko, lotes en perecederos, ventas en 90 días.

El calendario CR (Madre, Independencia, Navidad, regreso a clases) se anota como contexto; **no infla cantidades**.

## Roadmap (no incluido en este módulo)

Mermas vs conteo físico, canasta, precio por elasticidad, forecast estacional, simulador de caja/bodega, alertas de proveedor.

Esos agentes hermanos van **después**. Este módulo es el agente base.
