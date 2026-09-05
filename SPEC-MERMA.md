# MermaIA · contrato para Dyko

Agente hermano de InventarioIA. Compara **stock teórico** vs **conteo físico**.
No mezcla clasificación de compra. No ajusta existencias. No inventa conteos.

Identidad: `MermaIA` · Dyko Intelligence · Puntarenas, CRC · español.

## Qué no hace

- No da de baja.
- No corrige el teórico.
- No acusa hurto (es hipótesis).
- No estima merma en SKU `sin_conteo`.
- No emite OC ni promociones (eso es InventarioIA).

## Entrada

```ts
type PhysicalCount = {
  sku: string;
  countedQty: number;
  countedAt: string; // ISO date
  countedBy: string;
};
```

Catálogo: el mismo `ProductMetrics[]` de InventarioIA (`analyzeCatalog`).

```ts
analyzeShrinkage(metrics, counts) → ShrinkageRow[]
buildShrinkageReport(rows) → ShrinkageReport
```

Si un SKU del catálogo no está en `counts`, `stockFisico = null` y `clasificacion = sin_conteo`.

## Clasificación

| Clase | Cuándo |
|---|---|
| `cuadrado` | físico = teórico |
| `merma_operativa` | faltante en perecedero / lote vencido |
| `posible_hurto` | no perecedero, valor ≥ ₡8 000 y % ≥ 8%, sin vencimiento que lo explique |
| `error_probable_conteo` | ±1 unidad en stock ≥ 10 |
| `sobrante` | físico > teórico (más de 1) |
| `merma_no_clasificada` | faltante sin señal clara |
| `sin_conteo` | no hay conteo · **dato faltante** |

`posible_hurto` nunca es veredicto. Acción: `investigar` + reconteo.

## Acciones sugeridas (humano aprueba)

`ninguna` · `contar` · `recontar` · `dar_de_baja` · `investigar` · `ajustar_teorico`

MermaIA solo propone. El click en Dyko es la aprobación.

## JSON hacia Dyko

```json
{
  "fecha_analisis": "YYYY-MM-DD",
  "fecha_conteo": "YYYY-MM-DD | null",
  "resumen_ejecutivo": "…",
  "cobertura_conteo": { "skus_teoricos": 0, "skus_contados": 0, "porcentaje": 0 },
  "valor_merma_crc": 0,
  "valor_sobrante_crc": 0,
  "discrepancias": [
    {
      "sku": "DYK-…",
      "producto": "…",
      "stock_teorico": 0,
      "stock_fisico": null,
      "diferencia": null,
      "valor_crc": 0,
      "clasificacion": "sin_conteo",
      "justificacion": "…",
      "accion_sugerida": "contar"
    }
  ],
  "datos_faltantes_o_incertidumbre": [],
  "proximos_pasos_para_el_usuario": []
}
```

## Agente

`askInventoryAgent({ domain: "merma", catalog, counts, messages })`

Tools: `reporte_merma` · `discrepancias` · `merma_detail`.

InventarioIA no debe mezclar merma con la OC. MermaIA no clasifica compras.
