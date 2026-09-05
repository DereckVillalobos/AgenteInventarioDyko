import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeCatalog } from "../inventory/analytics.ts";
import type { Product } from "../inventory/types.ts";
import { analyzeShrinkage, buildShrinkageReport } from "./analytics.ts";
import type { PhysicalCount } from "./types.ts";

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

function count(sku: string, qty: number): PhysicalCount {
  return { sku, countedQty: qty, countedAt: "2026-09-05", countedBy: "Test" };
}

describe("merma vs conteo", () => {
  it("sin conteo no inventa físico ni merma", () => {
    const metrics = analyzeCatalog([product({ sku: "A", name: "Arroz", stock: 10 })]);
    const rows = analyzeShrinkage(metrics, []);
    assert.equal(rows[0]?.clasificacion, "sin_conteo");
    assert.equal(rows[0]?.stockFisico, null);
    assert.equal(rows[0]?.diferencia, null);
  });

  it("perecedero con faltante chico → merma_operativa", () => {
    const metrics = analyzeCatalog([
      product({
        sku: "L",
        name: "Leche",
        category: "lacteos",
        perishable: true,
        stock: 16,
        cost: 890,
        lots: [{ id: "x", qty: 16, expiry: "2026-09-09" }],
        dailySales: Array.from({ length: 90 }, () => 5),
      }),
    ], "2026-09-05");
    const rows = analyzeShrinkage(metrics, [count("L", 13)]);
    assert.equal(rows[0]?.clasificacion, "merma_operativa");
    assert.equal(rows[0]?.diferencia, -3);
  });

  it("no perecedero de alto valor faltante → posible_hurto", () => {
    const metrics = analyzeCatalog([
      product({
        sku: "P",
        name: "Pañales",
        category: "cuidado",
        perishable: false,
        stock: 46,
        cost: 6200,
        lots: [{ id: "x", qty: 46, expiry: "2028-01-01" }],
        dailySales: Array.from({ length: 90 }, () => 1),
      }),
    ]);
    const rows = analyzeShrinkage(metrics, [count("P", 40)]);
    assert.equal(rows[0]?.clasificacion, "posible_hurto");
    assert.equal(rows[0]?.accion_sugerida, "investigar");
  });

  it("el reporte no incluye SKUs inventados y declara cobertura", () => {
    const catalog = [
      product({ sku: "X1", name: "Uno", stock: 10 }),
      product({ sku: "X2", name: "Dos", stock: 5 }),
    ];
    const metrics = analyzeCatalog(catalog);
    const rows = analyzeShrinkage(metrics, [count("X1", 10)]);
    const report = buildShrinkageReport(rows, "2026-09-05");
    assert.equal(report.cobertura_conteo.skus_contados, 1);
    assert.equal(report.cobertura_conteo.skus_teoricos, 2);
    assert.ok(report.discrepancias.every((d) => ["X1", "X2"].includes(d.sku)));
    assert.ok(report.datos_faltantes_o_incertidumbre.length > 0);
    assert.ok(report.resumen_ejecutivo.includes("MermaIA"));
  });
});
