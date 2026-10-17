import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCatalog,
  buildAlerts,
  analyzeSnapshots,
  buildReport,
  marginAfterDiscount,
  maxDiscountPreservingMargin,
  trendOf,
} from "./analytics.ts";
import { selectCatalogForAgent } from "./select.ts";
import type { CatalogSnapshot, Product } from "./types.ts";

function product(partial: Partial<Product> & Pick<Product, "sku" | "name">): Product {
  return {
    id: partial.sku,
    brand: "Test",
    category: "abarrotes",
    unit: "un",
    cost: 1000,
    price: 2000,
    stock: 10,
    minStock: 5,
    maxStock: 40,
    leadDays: 5,
    perishable: false,
    lots: [],
    dailySales: Array.from({ length: 90 }, () => 2),
    ...partial,
  };
}

function snap(partial: Partial<CatalogSnapshot> & Pick<CatalogSnapshot, "sku" | "name">): CatalogSnapshot {
  return {
    brand: "Test",
    category: "abarrotes",
    unit: "un",
    cost: 1000,
    price: 2000,
    stock: 10,
    minStock: 5,
    maxStock: 40,
    leadDays: 5,
    perishable: false,
    lots: [],
    sales7: 14,
    sales30: 60,
    sales30Prev: 60,
    sales30Old: 60,
    sales90: 180,
    avgDaily: 2,
    ...partial,
  };
}

describe("margen y descuento", () => {
  it("no sugiere descuento que rompa el margen mínimo", () => {
    const max = maxDiscountPreservingMargin(1000, 2000, 0.25);
    assert.equal(max, 33);
    assert.ok(marginAfterDiscount(1000, 2000, max) >= 0.25 - 0.005);
  });

  it("si el piso es el precio, descuento máximo es 0", () => {
    assert.equal(maxDiscountPreservingMargin(1600, 2000, 0.25), 0);
  });
});

describe("clasificación de compra", () => {
  it("quiebre de stock con rotación → comprar_ya", () => {
    const metrics = analyzeCatalog([
      product({
        sku: "A",
        name: "Arroz",
        stock: 0,
        lots: [],
        dailySales: Array.from({ length: 90 }, () => 4),
      }),
    ]);
    assert.equal(metrics[0]?.orderAction, "comprar_ya");
    assert.ok((metrics[0]?.orderQty ?? 0) > 0);
  });

  it("rotación muerta no pide más", () => {
    const metrics = analyzeCatalog([
      product({
        sku: "B",
        name: "Lento",
        stock: 80,
        maxStock: 90,
        dailySales: Array.from({ length: 90 }, (_, i) => (i < 60 ? 1 : 0)),
      }),
    ]);
    assert.ok(["descontinuar", "no_comprar", "vigilar"].includes(metrics[0]?.orderAction ?? ""));
    assert.equal(metrics[0]?.orderQty, 0);
  });
});

describe("tendencia sin dato", () => {
  it("ventanas previas ausentes no se reportan como estable", () => {
    assert.equal(trendOf(null, null, 80), "sin_dato");
    const metrics = analyzeSnapshots([
      snap({ sku: "Z", name: "Nuevo", sales30: 80, sales30Prev: null, sales30Old: null, sales90: 80, avgDaily: 2.6 }),
    ]);
    assert.equal(metrics[0]?.tendencia, "sin_dato");
    assert.ok(metrics[0]?.datosFaltantes.some((d) => d.includes("tendencia")));
  });

  it("serie corta (<90 d) no inventa tendencia estable", () => {
    const metrics = analyzeCatalog([
      product({ sku: "C", name: "Corto", dailySales: Array.from({ length: 30 }, () => 3) }),
    ]);
    assert.equal(metrics[0]?.tendencia, "sin_dato");
    assert.equal(metrics[0]?.sales30Old, null);
  });
});

describe("bundle por afinidad", () => {
  it("no mezcla lácteo por vencer con snack de otra categoría", () => {
    const metrics = analyzeCatalog(
      [
        product({
          sku: "L",
          name: "Leche",
          category: "lacteos",
          perishable: true,
          stock: 12,
          dailySales: Array.from({ length: 90 }, () => 2),
          lots: [{ id: "x", qty: 12, expiry: "2026-09-08" }],
        }),
        product({
          sku: "Y",
          name: "Yogurt",
          category: "lacteos",
          perishable: true,
          stock: 40,
          dailySales: Array.from({ length: 90 }, () => 5),
          lots: [{ id: "y", qty: 40, expiry: "2026-10-01" }],
        }),
        product({
          sku: "S",
          name: "Chips",
          category: "snacks",
          stock: 80,
          dailySales: Array.from({ length: 90 }, () => 12),
        }),
      ],
      "2026-09-05",
    );
    const leche = metrics.find((m) => m.product.sku === "L");
    assert.ok(leche?.promo);
    if (leche?.promo?.tipo === "bundle") {
      assert.notEqual(leche.promo.bundleSku, "S");
      assert.equal(leche.promo.bundleSku, "Y");
    }
  });
});

describe("prioridad de catálogo del agente", () => {
  it("no toma los primeros N por orden de llegada: prioriza quiebre", () => {
    const filler = Array.from({ length: 20 }, (_, i) =>
      snap({ sku: `F${i}`, name: `Filler ${i}`, stock: 40, minStock: 5 }),
    );
    const urgent = snap({ sku: "OUT", name: "Agotado", stock: 0, minStock: 10 });
    const { selected, omitted, note } = selectCatalogForAgent([urgent, ...filler].reverse(), 10);
    assert.equal(selected.length, 10);
    assert.equal(omitted, 11);
    assert.ok(selected.some((s) => s.sku === "OUT"));
    assert.ok(note?.includes("21"));
  });

  it("bajo el tope analiza el 100% y no declara recorte", () => {
    const snaps = Array.from({ length: 90 }, (_, i) => snap({ sku: `S${i}`, name: `Sku ${i}` }));
    const sel = selectCatalogForAgent(snaps, 400);
    assert.equal(sel.analyzed, 90);
    assert.equal(sel.omitted, 0);
    assert.equal(sel.note, null);
  });
});

describe("reporte JSON Dyko", () => {
  it("cumple el esquema y no inventa SKUs", () => {
    const catalog = [
      product({ sku: "X1", name: "Uno", stock: 0 }),
      product({
        sku: "X2",
        name: "Dos",
        perishable: true,
        stock: 6,
        lots: [{ id: "l1", qty: 6, expiry: "2026-09-06" }],
        dailySales: Array.from({ length: 90 }, () => 1),
      }),
    ];
    const metrics = analyzeCatalog(catalog, "2026-09-04");
    const report = buildReport(metrics, "cuidadoso", "2026-09-04");
    assert.equal(report.fecha_analisis, "2026-09-04");
    assert.equal(report.salud_general_inventario.total_skus_analizados, 2);
    assert.ok(report.sugerencias_compra.every((r) => ["X1", "X2"].includes(r.sku)));
    assert.ok(report.datos_faltantes_o_incertidumbre.length > 0);
    assert.ok(report.resumen_ejecutivo.length > 40);
    const json = JSON.parse(JSON.stringify(report)) as typeof report;
    assert.ok(Array.isArray(json.alertas_vencimiento));
    assert.ok(json.proximos_pasos_para_el_usuario.length > 0);
  });

  it("declara recorte de catálogo en datos faltantes", () => {
    const metrics = analyzeCatalog([product({ sku: "A", name: "Arroz", stock: 0 })]);
    const report = buildReport(metrics, "cuidadoso", "2026-09-04", {
      total: 500,
      analyzed: 400,
      omitted: 100,
      note: "Se analizaron 400 de 500 SKU.",
    });
    assert.equal(report.salud_general_inventario.total_skus_recibidos, 500);
    assert.ok(report.datos_faltantes_o_incertidumbre.some((d) => d.includes("400 de 500")));
  });

  it("modo rapido solo incluye críticos", () => {
    const catalog = [
      product({ sku: "X1", name: "Uno", stock: 0 }),
      product({
        sku: "X3",
        name: "Sano",
        stock: 40,
        minStock: 10,
        maxStock: 80,
        dailySales: Array.from({ length: 90 }, () => 2),
      }),
    ];
    const metrics = analyzeCatalog(catalog, "2026-09-04");
    const report = buildReport(metrics, "rapido", "2026-09-04");
    assert.ok(report.sugerencias_compra.every((r) => r.clasificacion === "comprar_ya"));
    assert.ok(report.alertas_vencimiento.every((a) => a.nivel === "critico"));
  });
});

describe("seguridad de vencimientos", () => {
  it("nunca propone liquidar ni descontar unidades vencidas", () => {
    const metrics = analyzeCatalog(
      [
        product({
          sku: "VENCIDO",
          name: "Lácteo vencido",
          category: "lacteos",
          perishable: true,
          stock: 10,
          lots: [{ id: "lote-vencido", qty: 10, expiry: "2026-10-01" }],
        }),
      ],
      "2026-10-14",
    );
    assert.ok((metrics[0]?.expiredQty ?? 0) > 0);
    assert.equal(metrics[0]?.promo, null);
    const alert = buildAlerts(metrics).find((item) => item.kind === "vencimiento");
    assert.ok(alert);
    assert.match(alert.detail, /No promocionar/);
    assert.match(alert.detail, /vencidas/);
  });

  it("mantiene las propuestas para lotes próximos a vencer pero aún vigentes", () => {
    const metrics = analyzeCatalog(
      [
        product({
          sku: "PROXIMO",
          name: "Lácteo próximo a vencer",
          category: "lacteos",
          perishable: true,
          stock: 10,
          lots: [{ id: "lote-vigente", qty: 10, expiry: "2026-10-16" }],
        }),
      ],
      "2026-10-14",
    );
    assert.equal(metrics[0]?.expiredQty, 0);
    assert.ok(metrics[0]?.promo);
  });
});
