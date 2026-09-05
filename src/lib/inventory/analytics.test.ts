import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCatalog,
  buildReport,
  marginAfterDiscount,
  maxDiscountPreservingMargin,
} from "./analytics.ts";
import type { Product } from "./types.ts";

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
