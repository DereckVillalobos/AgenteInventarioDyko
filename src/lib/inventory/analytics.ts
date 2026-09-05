import { diffDays, todayLocalIso } from "./format";
import type {
  AbcClass,
  CatalogSnapshot,
  HealthStatus,
  InventoryAlert,
  Product,
  ProductMetrics,
  PromoRec,
  Velocity,
} from "./types";

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function toSnapshot(p: Product): CatalogSnapshot {
  const sales90 = sum(p.dailySales);
  const sales30 = sum(p.dailySales.slice(-30));
  const sales7 = sum(p.dailySales.slice(-7));
  return {
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category,
    unit: p.unit,
    cost: p.cost,
    price: p.price,
    stock: p.stock,
    minStock: p.minStock,
    maxStock: p.maxStock,
    leadDays: p.leadDays,
    perishable: p.perishable,
    lots: p.lots,
    sales7,
    sales30,
    sales90,
    avgDaily: sales90 / Math.max(p.dailySales.length, 1),
  };
}

export function snapshotToProduct(s: CatalogSnapshot): Product {
  return {
    id: s.sku,
    sku: s.sku,
    name: s.name,
    brand: s.brand,
    category: s.category,
    unit: s.unit,
    cost: s.cost,
    price: s.price,
    stock: s.stock,
    minStock: s.minStock,
    maxStock: s.maxStock,
    leadDays: s.leadDays,
    perishable: s.perishable,
    lots: s.lots,
    dailySales: [],
  };
}

function velocityOf(avgDaily: number): Velocity {
  if (avgDaily < 0.2) return "muerta";
  if (avgDaily < 1.5) return "baja";
  if (avgDaily < 4) return "media";
  return "alta";
}

function targetStock(p: Product, avgDaily: number, daysToExpiry: number | null): number {
  const coverDays = p.perishable ? Math.min(10, 5 + p.leadDays) : 14 + p.leadDays;
  let raw = Math.ceil(avgDaily * coverDays);
  if (p.perishable && daysToExpiry !== null && daysToExpiry > 0) {
    raw = Math.min(raw, Math.ceil(avgDaily * Math.max(2, daysToExpiry - 1)));
  }
  return clamp(Math.max(raw, p.minStock), 0, p.maxStock);
}

function promoFor(args: {
  p: Product;
  avgDaily: number;
  daysCover: number | null;
  daysToExpiry: number | null;
  expiredQty: number;
  expiring14Qty: number;
  velocity: Velocity;
}): PromoRec | null {
  const { p, avgDaily, daysCover, daysToExpiry, expiredQty, expiring14Qty, velocity } = args;
  if (expiredQty > 0) {
    return {
      discount: 50,
      reason: `${expiredQty} ${p.unit} ya vencidos. Liquidar de inmediato o dar de baja.`,
      urgency: "alta",
    };
  }
  if (daysToExpiry !== null && daysToExpiry <= 2 && expiring14Qty > 0) {
    return {
      discount: 40,
      reason: `Vence en ${daysToExpiry} día${daysToExpiry === 1 ? "" : "s"}. Mover con oferta agresiva.`,
      urgency: "alta",
    };
  }
  if (daysToExpiry !== null && daysToExpiry <= 7 && expiring14Qty >= Math.max(4, avgDaily * 3)) {
    return {
      discount: 30,
      reason: `${expiring14Qty} ${p.unit} vencen en ${daysToExpiry} días. Promoción de salida.`,
      urgency: "alta",
    };
  }
  if (daysToExpiry !== null && daysToExpiry <= 14 && expiring14Qty >= Math.max(6, avgDaily * 5)) {
    return {
      discount: 20,
      reason: `Lote grande por vencer en ${daysToExpiry} días. Oferta 2x1 o descuento.`,
      urgency: "media",
    };
  }
  if ((velocity === "muerta" || velocity === "baja") && (daysCover ?? 0) > 45 && p.stock > p.minStock) {
    return {
      discount: velocity === "muerta" ? 35 : 25,
      reason: `Rotación ${velocity} y ${daysCover === null ? "sin salida" : `${Math.round(daysCover)} días de cobertura`}. No reponer; promocionar.`,
      urgency: velocity === "muerta" ? "alta" : "media",
    };
  }
  return null;
}

function assignAbc(items: { sku: string; revenue: number }[]): Map<string, AbcClass> {
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, x) => s + x.revenue, 0) || 1;
  const map = new Map<string, AbcClass>();
  let acc = 0;
  for (const row of sorted) {
    acc += row.revenue;
    const share = acc / total;
    map.set(row.sku, share <= 0.7 ? "A" : share <= 0.9 ? "B" : "C");
  }
  return map;
}

type SalesSlice = { sales7: number; sales30: number; sales90: number; avgDaily: number };

function scoreItems(items: { product: Product; sales: SalesSlice }[], today: string): ProductMetrics[] {
  const abc = assignAbc(
    items.map(({ product, sales }) => ({
      sku: product.sku,
      revenue: sales.sales90 * product.price,
    })),
  );

  return items
    .map(({ product: p, sales }) => {
      const { sales90, sales30, sales7, avgDaily } = sales;
      const daysCover = avgDaily > 0.05 ? p.stock / avgDaily : p.stock > 0 ? 999 : 0;
      const lots = [...p.lots].sort((a, b) => a.expiry.localeCompare(b.expiry));
      const nearest = lots[0]?.expiry ?? null;
      const daysToExpiry = nearest ? diffDays(today, nearest) : null;
      const expiredQty = lots.filter((l) => diffDays(today, l.expiry) < 0).reduce((s, l) => s + l.qty, 0);
      const expiring14Qty = lots
        .filter((l) => {
          const d = diffDays(today, l.expiry);
          return d >= 0 && d <= 14;
        })
        .reduce((s, l) => s + l.qty, 0);

      const velocity = velocityOf(avgDaily);
      const target = targetStock(p, avgDaily, daysToExpiry);
      const stockValue = p.stock * p.cost;
      const marginPct = p.price > 0 ? (p.price - p.cost) / p.price : 0;

      let status: HealthStatus = "saludable";
      if (expiredQty > 0) status = "vencido";
      else if (p.stock <= 0) status = "agotado";
      else if (daysToExpiry !== null && daysToExpiry <= 7 && p.perishable) status = "vence";
      else if (p.stock <= Math.ceil(p.minStock * 0.5) || p.stock <= Math.ceil(avgDaily * p.leadDays))
        status = "critico";
      else if (p.stock <= p.minStock) status = "bajo";
      else if (p.stock > p.maxStock || (typeof daysCover === "number" && daysCover > 60))
        status = "exceso";
      else if (daysToExpiry !== null && daysToExpiry <= 14 && expiring14Qty > 0) status = "vence";

      let orderQty = Math.max(0, target - p.stock);
      if (status === "exceso" || velocity === "muerta") orderQty = 0;
      if (expiredQty > 0 && p.stock - expiredQty >= target) orderQty = 0;
      if (p.perishable && daysToExpiry !== null && daysToExpiry <= 5 && p.stock > avgDaily * 2) {
        orderQty = 0;
      }

      let orderAction: ProductMetrics["orderAction"] = "no_pedir";
      let orderReason = "Stock dentro de banda saludable.";
      if (p.stock <= 0 && velocity !== "muerta") {
        orderAction = "urgente";
        orderQty = Math.max(orderQty, p.minStock);
        orderReason = `Quiebre de stock. Rotación ${velocity} (${avgDaily.toFixed(1)}/día). Pedir ${orderQty} ${p.unit}.`;
      } else if ((status === "critico" || status === "bajo") && velocity !== "muerta" && velocity !== "baja") {
        orderAction = "urgente";
        orderReason = `Solo ${p.stock} ${p.unit} (mín. ${p.minStock}). Cobertura ${daysCover === 999 ? "n/d" : `${Math.round(daysCover)} d`}. Pedir ${orderQty} ${p.unit}.`;
      } else if (orderQty > 0 && velocity !== "muerta") {
        orderAction = velocity === "baja" ? "no_pedir" : "pedir";
        orderReason =
          velocity === "baja"
            ? `Rotación baja: no inflar. Si acaso reponer hasta mínimo (${p.minStock}).`
            : `Reponer ${orderQty} ${p.unit} para llegar a stock saludable de ${target} ${p.unit}.`;
        if (velocity === "baja") orderQty = 0;
      } else if (status === "exceso") {
        orderAction = "no_pedir";
        orderReason = `Exceso: ${p.stock} ${p.unit} vs máximo ${p.maxStock}. Cobertura ${Math.round(daysCover)} días.`;
      } else if (velocity === "muerta") {
        orderAction = "no_pedir";
        orderReason = "Rotación muerta. No pedir; evaluar promoción o baja.";
      } else if (p.perishable && daysToExpiry !== null && daysToExpiry <= 5) {
        orderAction = "no_pedir";
        orderReason = `Hay producto por vencer en ${daysToExpiry} días. Primero rotar el lote actual.`;
      }

      const promo = promoFor({
        p,
        avgDaily,
        daysCover: daysCover === 999 ? null : daysCover,
        daysToExpiry,
        expiredQty,
        expiring14Qty,
        velocity,
      });

      return {
        product: p,
        sales7,
        sales30,
        sales90,
        avgDaily,
        daysCover: daysCover === 999 ? null : daysCover,
        nearestExpiry: nearest,
        daysToExpiry,
        expiredQty,
        expiring14Qty,
        abc: abc.get(p.sku) ?? "C",
        velocity,
        status,
        targetStock: target,
        orderQty,
        orderAction,
        orderReason,
        promo,
        stockValue,
        marginPct,
      } satisfies ProductMetrics;
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name, "es"));
}

export function analyzeCatalog(products: Product[], today = todayLocalIso()): ProductMetrics[] {
  return scoreItems(
    products.map((p) => ({
      product: p,
      sales: {
        sales90: sum(p.dailySales),
        sales30: sum(p.dailySales.slice(-30)),
        sales7: sum(p.dailySales.slice(-7)),
        avgDaily: sum(p.dailySales) / Math.max(p.dailySales.length, 1),
      },
    })),
    today,
  );
}

export function analyzeSnapshots(snaps: CatalogSnapshot[], today = todayLocalIso()): ProductMetrics[] {
  return scoreItems(
    snaps.map((s) => ({
      product: snapshotToProduct(s),
      sales: {
        sales7: s.sales7,
        sales30: s.sales30,
        sales90: s.sales90,
        avgDaily: s.avgDaily,
      },
    })),
    today,
  );
}

export function buildAlerts(metrics: ProductMetrics[]): InventoryAlert[] {
  const alerts: InventoryAlert[] = [];
  for (const m of metrics) {
    const p = m.product;
    if (m.status === "agotado") {
      alerts.push({
        id: `out-${p.sku}`,
        kind: "quiebre",
        sku: p.sku,
        title: `${p.name} agotado`,
        detail: m.orderReason,
        severity: "alta",
      });
    } else if (m.status === "critico") {
      alerts.push({
        id: `crit-${p.sku}`,
        kind: "quiebre",
        sku: p.sku,
        title: `${p.name} en crítico`,
        detail: `Quedan ${p.stock} ${p.unit}. ${m.orderReason}`,
        severity: "alta",
      });
    }
    if (m.status === "vencido" || (m.daysToExpiry !== null && m.daysToExpiry <= 7 && m.expiring14Qty > 0)) {
      alerts.push({
        id: `exp-${p.sku}`,
        kind: "vencimiento",
        sku: p.sku,
        title:
          m.status === "vencido"
            ? `${p.name}: lote vencido`
            : `${p.name} vence en ${m.daysToExpiry} d`,
        detail: m.promo?.reason ?? `${m.expiring14Qty} ${p.unit} en ventana de 14 días.`,
        severity: m.daysToExpiry !== null && m.daysToExpiry <= 3 ? "alta" : "media",
      });
    }
    if (m.status === "exceso" && (m.velocity === "baja" || m.velocity === "muerta")) {
      alerts.push({
        id: `exc-${p.sku}`,
        kind: "exceso",
        sku: p.sku,
        title: `Exceso de ${p.name}`,
        detail: m.orderReason,
        severity: m.velocity === "muerta" ? "media" : "baja",
      });
    }
  }
  const rank = { alta: 0, media: 1, baja: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title, "es"));
}

export function kpis(metrics: ProductMetrics[]) {
  const stockValue = metrics.reduce((s, m) => s + m.stockValue, 0);
  const crit = metrics.filter((m) => m.status === "agotado" || m.status === "critico").length;
  const expiring = metrics.filter((m) => m.expiring14Qty > 0 || m.expiredQty > 0).length;
  const pedir = metrics.filter((m) => m.orderAction !== "no_pedir");
  const orderValue = pedir.reduce((s, m) => s + m.orderQty * m.product.cost, 0);
  const promos = metrics.filter((m) => m.promo).length;
  const healthy = metrics.filter((m) => m.status === "saludable").length;
  return {
    skuCount: metrics.length,
    stockValue,
    crit,
    expiring,
    orderLines: pedir.length,
    orderValue,
    promos,
    healthy,
    healthyPct: metrics.length ? Math.round((healthy / metrics.length) * 100) : 0,
  };
}

export function briefing(metrics: ProductMetrics[]): string[] {
  const stats = kpis(metrics);
  const urgent = metrics.filter((m) => m.orderAction === "urgente").slice(0, 3);
  const exp = metrics
    .filter((m) => m.daysToExpiry !== null && m.daysToExpiry <= 5)
    .sort((a, b) => (a.daysToExpiry ?? 99) - (b.daysToExpiry ?? 99))
    .slice(0, 3);
  const promo = metrics.filter((m) => m.promo?.urgency === "alta").slice(0, 2);
  const lines: string[] = [];
  lines.push(
    `${stats.skuCount} SKU · inventario a costo ${stats.stockValue.toLocaleString("es-CR")} CRC · ${stats.healthyPct}% en banda saludable.`,
  );
  if (urgent.length) {
    lines.push(
      `Pedir ya: ${urgent.map((m) => `${m.product.name} (${m.orderQty} ${m.product.unit})`).join("; ")}.`,
    );
  }
  if (exp.length) {
    lines.push(
      `Vencimientos próximos: ${exp.map((m) => `${m.product.name} (${m.daysToExpiry} d)`).join("; ")}.`,
    );
  }
  if (promo.length) {
    lines.push(
      `Promoción urgente: ${promo.map((m) => `${m.product.name} −${m.promo?.discount}%`).join("; ")}.`,
    );
  }
  const noBuy = metrics.filter((m) => m.orderAction === "no_pedir" && m.status === "exceso").slice(0, 2);
  if (noBuy.length) {
    lines.push(
      `No reponer: ${noBuy.map((m) => m.product.name).join(", ")} — exceso o rotación lenta.`,
    );
  }
  return lines;
}
