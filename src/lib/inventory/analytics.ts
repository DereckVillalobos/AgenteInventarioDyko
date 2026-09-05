import { diffDays, todayLocalIso } from "./format";
import type {
  AbcClass,
  AgentMode,
  BusinessParams,
  BuyClass,
  CatalogCoverage,
  CatalogSnapshot,
  ExpiryNivel,
  HealthStatus,
  InventoryAlert,
  InventoryReport,
  Product,
  ProductMetrics,
  PromoRec,
  Trend,
  Velocity,
} from "./types";
import { COMPLEMENT_CATEGORIES, DEFAULT_PARAMS } from "./types";


function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function maxDiscountPreservingMargin(cost: number, price: number, minMargin: number): number {
  if (price <= 0 || minMargin >= 1) return 0;
  const floor = cost / (1 - minMargin);
  if (floor >= price) return 0;
  return Math.max(0, Math.floor((1 - floor / price) * 100));
}

export function marginAfterDiscount(cost: number, price: number, discountPct: number): number {
  const p = price * (1 - discountPct / 100);
  if (p <= 0) return 0;
  return (p - cost) / p;
}

export function toSnapshot(p: Product): CatalogSnapshot {
  const n = p.dailySales.length;
  const sales90 = sum(p.dailySales);
  const sales30 = sum(p.dailySales.slice(-30));
  const sales30Prev = n >= 60 ? sum(p.dailySales.slice(-60, -30)) : null;
  const sales30Old = n >= 90 ? sum(p.dailySales.slice(-90, -60)) : null;
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
    sales30Prev,
    sales30Old,
    sales90,
    avgDaily: sales90 / Math.max(n, 1),
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

export function trendOf(old30: number | null, prev30: number | null, last30: number): Trend {
  if (old30 == null || prev30 == null) return "sin_dato";
  if (old30 + prev30 + last30 === 0) return "sin_dato";
  const down = last30 < prev30 && prev30 < old30;
  const up = last30 > prev30 && prev30 > old30;
  if (down) return "baja";
  if (up) return "sube";
  return "estable";
}

function expiryNivelOf(days: number | null, expiredQty: number, params: BusinessParams): ExpiryNivel | null {
  if (expiredQty > 0) return "critico";
  if (days === null) return null;
  if (days <= params.vencimientoCriticoDias) return "critico";
  if (days <= params.vencimientoAlertaDias) return "alerta";
  if (days <= params.vencimientoVigilarDias) return "vigilar";
  return null;
}

function qtyInWindow(lots: Product["lots"], today: string, minD: number, maxD: number) {
  return lots
    .filter((l) => {
      const d = diffDays(today, l.expiry);
      return d >= minD && d <= maxD;
    })
    .reduce((s, l) => s + l.qty, 0);
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

type SalesSlice = {
  sales7: number;
  sales30: number;
  sales30Prev: number | null;
  sales30Old: number | null;
  sales90: number;
  avgDaily: number;
};

function promoFor(args: {
  p: Product;
  avgDaily: number;
  daysCover: number | null;
  daysToExpiry: number | null;
  expiredQty: number;
  expiring7Qty: number;
  expiring30Qty: number;
  velocity: Velocity;
  nivel: ExpiryNivel | null;
  params: BusinessParams;
  bundle: { sku: string; name: string } | null;
}): PromoRec | null {
  const { p, daysCover, daysToExpiry, expiredQty, expiring7Qty, expiring30Qty, velocity, nivel, params, bundle } =
    args;
  const maxPct = maxDiscountPreservingMargin(p.cost, p.price, params.margenMinimo);

  const make = (
    tipo: PromoRec["tipo"],
    wantPct: number,
    reason: string,
    urgency: ExpiryNivel,
    forceLoss = false,
  ): PromoRec => {
    let discount = Math.min(wantPct, maxPct);
    let perdida = false;
    if (forceLoss || (wantPct > maxPct && urgency === "critico")) {
      discount = wantPct;
      perdida = marginAfterDiscount(p.cost, p.price, discount) < params.margenMinimo;
    }
    const margen = round2(marginAfterDiscount(p.cost, p.price, discount) * 100);
    return {
      tipo,
      discount,
      descuento_maximo_pct: maxPct,
      margen_resultante_pct: margen,
      perdida_controlada: perdida,
      reason,
      justificacion: perdida
        ? `${reason} Pérdida controlada: el descuento ${discount}% deja margen ${margen}% (mínimo ${Math.round(params.margenMinimo * 100)}%). Solo por vencimiento inminente; requiere aprobación.`
        : `${reason} Descuento ${discount}% (máx. que preserva margen mínimo ${Math.round(params.margenMinimo * 100)}% → margen resultante ${margen}%). Requiere aprobación humana.`,
      urgency,
      bundleSku: tipo === "bundle" ? bundle?.sku : undefined,
      bundleName: tipo === "bundle" ? bundle?.name : undefined,
    };
  };

  if (expiredQty > 0) {
    return make(
      "liquidacion",
      Math.max(50, maxPct),
      `${expiredQty} ${p.unit} ya vencidos. Liquidar o dar de baja.`,
      "critico",
      true,
    );
  }
  if (daysToExpiry !== null && daysToExpiry <= 2 && expiring7Qty > 0) {
    return make(
      "descuento",
      Math.max(40, maxPct),
      `Vence en ${daysToExpiry} día${daysToExpiry === 1 ? "" : "s"}. ${expiring7Qty} ${p.unit} en riesgo.`,
      "critico",
      true,
    );
  }
  if (nivel === "critico" && expiring7Qty > 0) {
    const tipo = bundle ? "bundle" : "descuento";
    const extra = bundle ? ` Combo con ${bundle.name} (${bundle.sku}).` : "";
    return make(
      tipo,
      Math.max(25, Math.min(35, maxPct || 25)),
      `${expiring7Qty} ${p.unit} vencen en ${daysToExpiry} días.${extra}`,
      "critico",
    );
  }
  if (nivel === "alerta" && expiring30Qty >= Math.max(4, args.avgDaily * 5)) {
    const tipo = bundle ? "bundle" : "descuento";
    const extra = bundle ? ` Palanca: bundle con ${bundle.name}.` : "";
    return make(
      tipo,
      Math.min(20, maxPct || 15),
      `Lote en ventana de 30 días (${expiring30Qty} ${p.unit}).${extra}`,
      "alerta",
    );
  }
  if ((velocity === "muerta" || velocity === "baja") && (daysCover ?? 0) > 45 && p.stock > p.minStock) {
    return make(
      "descuento",
      velocity === "muerta" ? Math.min(35, maxPct || 25) : Math.min(20, maxPct || 15),
      `Rotación ${velocity} y ${daysCover === null ? "sin salida" : `${Math.round(daysCover)} días de cobertura`}. No reponer.`,
      velocity === "muerta" ? "alerta" : "vigilar",
    );
  }
  return null;
}

function classifyBuy(args: {
  p: Product;
  avgDaily: number;
  daysCover: number | null;
  velocity: Velocity;
  tendencia: Trend;
  status: HealthStatus;
  target: number;
  safetyDays: number;
  sobreStockDias: number;
  daysToExpiry: number | null;
}): { action: BuyClass; qty: number; reason: string } {
  const { p, avgDaily, daysCover, velocity, tendencia, status, target, safetyDays, sobreStockDias, daysToExpiry } =
    args;
  const cover = daysCover;
  const lead = p.leadDays;
  const reorderPoint = avgDaily * (lead + safetyDays);
  let qty = Math.max(0, Math.ceil(reorderPoint - p.stock));
  qty = clamp(qty, 0, Math.max(0, p.maxStock - p.stock));

  if (p.perishable && daysToExpiry !== null && daysToExpiry <= 5 && p.stock > avgDaily * 2) {
    return {
      action: "no_comprar",
      qty: 0,
      reason: `Hay lote por vencer en ${daysToExpiry} días que cubre la demanda. Primero rotar (FEFO); no pedir.`,
    };
  }

  if (velocity === "muerta" && (tendencia === "baja" || (cover ?? 0) > sobreStockDias)) {
    return {
      action: "descontinuar",
      qty: 0,
      reason: `Rotación muerta (${avgDaily.toFixed(1)}/día) y tendencia ${tendencia}. No pedir; evaluar baja del catálogo.`,
    };
  }

  if (status === "exceso" || (cover !== null && cover > sobreStockDias)) {
    return {
      action: "no_comprar",
      qty: 0,
      reason: `Sobre-stock: ${p.stock} ${p.unit}, cobertura ${cover === null ? "n/d" : `${Math.round(cover)} d`} (umbral ${sobreStockDias} d).`,
    };
  }

  if (p.stock <= 0 && velocity !== "muerta") {
    return {
      action: "comprar_ya",
      qty: Math.max(qty, p.minStock),
      reason: `Quiebre de stock. Rotación ${velocity} (${avgDaily.toFixed(1)}/día). Pedir ${Math.max(qty, p.minStock)} ${p.unit}. El humano aprueba.`,
    };
  }

  if (cover !== null && cover < lead && velocity !== "muerta" && velocity !== "baja") {
    return {
      action: "comprar_ya",
      qty: Math.max(qty, 1),
      reason: `Cobertura ${Math.round(cover)} d < lead time ${lead} d. Quiebre inminente. Pedir ${Math.max(qty, 1)} ${p.unit}.`,
    };
  }

  if ((status === "critico" || status === "bajo") && velocity !== "muerta" && velocity !== "baja") {
    return {
      action: "comprar_ya",
      qty: Math.max(qty, 1),
      reason: `Solo ${p.stock} ${p.unit} (mín. ${p.minStock}). Cobertura ${cover === null ? "n/d" : `${Math.round(cover)} d`}. Pedir ${Math.max(qty, 1)} ${p.unit}.`,
    };
  }

  if (tendencia === "baja" && velocity === "baja") {
    return {
      action: "vigilar",
      qty: 0,
      reason: `Rotación a la baja en los últimos 3 periodos. No inflar; vigilar 1 ciclo más.`,
    };
  }

  if (qty > 0 && (velocity === "alta" || velocity === "media")) {
    return {
      action: "comprar_pronto",
      qty,
      reason: `Reponer ${qty} ${p.unit} = rotación diaria ${avgDaily.toFixed(1)} × (lead ${lead} + seguridad ${safetyDays}) − stock ${p.stock}. Objetivo ${target}.`,
    };
  }

  if (velocity === "baja") {
    return {
      action: "no_comprar",
      qty: 0,
      reason: `Rotación baja: no inflar. Si acaso reponer hasta mínimo (${p.minStock}).`,
    };
  }

  return {
    action: "vigilar",
    qty: 0,
    reason: "Stock dentro de banda saludable. Vigilar; no hay pedido ahora.",
  };
}

function pickBundle(items: ProductMetrics[], current: Product): { sku: string; name: string } | null {
  const pool = items.filter(
    (m) => m.product.sku !== current.sku && m.velocity === "alta" && m.product.stock > 0,
  );
  const byDaily = (a: ProductMetrics, b: ProductMetrics) => b.avgDaily - a.avgDaily;
  const same = pool.filter((m) => m.product.category === current.category).sort(byDaily)[0];
  if (same) return { sku: same.product.sku, name: same.product.name };
  const allied = COMPLEMENT_CATEGORIES[current.category] ?? [];
  const complement = pool.filter((m) => allied.includes(m.product.category)).sort(byDaily)[0];
  if (complement) return { sku: complement.product.sku, name: complement.product.name };
  return null;
}

function scoreItems(
  items: { product: Product; sales: SalesSlice }[],
  today: string,
  params: BusinessParams,
): ProductMetrics[] {
  const abc = assignAbc(
    items.map(({ product, sales }) => ({
      sku: product.sku,
      revenue: sales.sales90 * product.price,
    })),
  );

  const prelim = items.map(({ product: p, sales }) => {
    const { sales90, sales30, sales30Prev, sales30Old, sales7, avgDaily } = sales;
    const daysCover = avgDaily > 0.05 ? p.stock / avgDaily : p.stock > 0 ? 999 : 0;
    const lots = [...p.lots].sort((a, b) => a.expiry.localeCompare(b.expiry));
    const nearest = lots[0]?.expiry ?? null;
    const daysToExpiry = nearest ? diffDays(today, nearest) : null;
    const expiredQty = qtyInWindow(lots, today, -3650, -1);
    const expiring7Qty = qtyInWindow(lots, today, 0, params.vencimientoCriticoDias);
    const expiring30Qty = qtyInWindow(lots, today, 0, params.vencimientoAlertaDias);
    const expiring60Qty = qtyInWindow(lots, today, 0, params.vencimientoVigilarDias);
    const nivel = expiryNivelOf(daysToExpiry, expiredQty, params);
    const velocity = velocityOf(avgDaily);
    const tendencia = trendOf(sales30Old, sales30Prev, sales30);
    const safety = params.stockSeguridadDias[p.category];
    const coverDays = p.perishable ? Math.min(10, 5 + p.leadDays) : 14 + p.leadDays;
    let raw = Math.ceil(avgDaily * coverDays);
    if (p.perishable && daysToExpiry !== null && daysToExpiry > 0) {
      raw = Math.min(raw, Math.ceil(avgDaily * Math.max(2, daysToExpiry - 1)));
    }
    const target = clamp(Math.max(raw, p.minStock), 0, p.maxStock);

    let status: HealthStatus = "saludable";
    if (expiredQty > 0) status = "vencido";
    else if (p.stock <= 0) status = "agotado";
    else if (daysToExpiry !== null && daysToExpiry <= params.vencimientoCriticoDias && p.perishable)
      status = "vence";
    else if (p.stock <= Math.ceil(p.minStock * 0.5) || (avgDaily > 0 && daysCover < p.leadDays))
      status = "critico";
    else if (p.stock <= p.minStock) status = "bajo";
    else if (p.stock > p.maxStock || daysCover > params.sobreStockDias) status = "exceso";
    else if (daysToExpiry !== null && daysToExpiry <= params.vencimientoAlertaDias && expiring30Qty > 0)
      status = "vence";

    const buy = classifyBuy({
      p,
      avgDaily,
      daysCover: daysCover === 999 ? null : daysCover,
      velocity,
      tendencia,
      status,
      target,
      safetyDays: safety,
      sobreStockDias: params.sobreStockDias,
      daysToExpiry,
    });

    const faltantes: string[] = [];
    if (p.perishable && lots.length === 0) faltantes.push("sin lotes/fecha de vencimiento");
    if (sales90 === 0) faltantes.push("sin ventas en 90 días");
    if (!p.leadDays) faltantes.push("lead time no informado");
    if (sales30Prev == null || sales30Old == null) {
      faltantes.push("sin ventas 30–90 d: tendencia no calculable");
    }

    return {
      product: p,
      sales7,
      sales30,
      sales30Prev,
      sales30Old,
      sales90,
      avgDaily,
      rotacionMensual: round1(sales30),
      tendencia,
      daysCover: daysCover === 999 ? null : daysCover,
      nearestExpiry: nearest,
      daysToExpiry,
      expiredQty,
      expiring7Qty,
      expiring30Qty,
      expiring60Qty,
      expiryNivel: nivel,
      abc: abc.get(p.sku) ?? "C",
      velocity,
      status,
      targetStock: target,
      orderQty: buy.qty,
      orderAction: buy.action,
      orderReason: buy.reason,
      promo: null as PromoRec | null,
      stockValue: p.stock * p.cost,
      marginPct: p.price > 0 ? (p.price - p.cost) / p.price : 0,
      datosFaltantes: faltantes,
    } satisfies ProductMetrics;
  });

  const ranked = prelim.sort((a, b) => a.product.name.localeCompare(b.product.name, "es"));
  return ranked.map((m) => ({
    ...m,
    promo: promoFor({
      p: m.product,
      avgDaily: m.avgDaily,
      daysCover: m.daysCover,
      daysToExpiry: m.daysToExpiry,
      expiredQty: m.expiredQty,
      expiring7Qty: m.expiring7Qty,
      expiring30Qty: m.expiring30Qty,
      velocity: m.velocity,
      nivel: m.expiryNivel,
      params,
      bundle: pickBundle(ranked, m.product),
    }),
  }));
}

function salesFromProduct(p: Product): SalesSlice {
  const d = p.dailySales;
  const n = d.length;
  return {
    sales90: sum(d),
    sales30: sum(d.slice(-30)),
    sales30Prev: n >= 60 ? sum(d.slice(-60, -30)) : null,
    sales30Old: n >= 90 ? sum(d.slice(-90, -60)) : null,
    sales7: sum(d.slice(-7)),
    avgDaily: sum(d) / Math.max(n, 1),
  };
}

export function analyzeCatalog(
  products: Product[],
  today = todayLocalIso(),
  params: BusinessParams = DEFAULT_PARAMS,
): ProductMetrics[] {
  return scoreItems(
    products.map((p) => ({ product: p, sales: salesFromProduct(p) })),
    today,
    params,
  );
}

export function analyzeSnapshots(
  snaps: CatalogSnapshot[],
  today = todayLocalIso(),
  params: BusinessParams = DEFAULT_PARAMS,
): ProductMetrics[] {
  return scoreItems(
    snaps.map((s) => ({
      product: snapshotToProduct(s),
      sales: {
        sales7: s.sales7,
        sales30: s.sales30,
        sales30Prev: s.sales30Prev ?? null,
        sales30Old: s.sales30Old ?? null,
        sales90: s.sales90,
        avgDaily: s.avgDaily,
      },
    })),
    today,
    params,
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
    if (m.expiryNivel === "critico" || m.status === "vencido") {
      alerts.push({
        id: `exp-${p.sku}`,
        kind: "vencimiento",
        sku: p.sku,
        title: m.status === "vencido" ? `${p.name}: lote vencido` : `${p.name} vence en ${m.daysToExpiry} d`,
        detail: m.promo?.justificacion ?? `${m.expiring7Qty} ${p.unit} en ventana crítica.`,
        severity: "alta",
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
  const expiring = metrics.filter((m) => m.expiring30Qty > 0 || m.expiredQty > 0).length;
  const pedir = metrics.filter((m) => m.orderAction === "comprar_ya" || m.orderAction === "comprar_pronto");
  const orderValue = pedir.reduce((s, m) => s + m.orderQty * m.product.cost, 0);
  const promos = metrics.filter((m) => m.promo).length;
  const healthy = metrics.filter((m) => m.status === "saludable").length;
  const over = metrics.filter((m) => m.status === "exceso").length;
  return {
    skuCount: metrics.length,
    stockValue,
    crit,
    expiring,
    over,
    orderLines: pedir.length,
    orderValue,
    promos,
    healthy,
    healthyPct: metrics.length ? Math.round((healthy / metrics.length) * 100) : 0,
  };
}

export function briefing(metrics: ProductMetrics[]): string[] {
  const stats = kpis(metrics);
  const urgent = metrics.filter((m) => m.orderAction === "comprar_ya").slice(0, 3);
  const exp = metrics
    .filter((m) => m.expiryNivel === "critico")
    .sort((a, b) => (a.daysToExpiry ?? 99) - (b.daysToExpiry ?? 99))
    .slice(0, 3);
  const promo = metrics.filter((m) => m.promo?.urgency === "critico").slice(0, 2);
  const lines: string[] = [];
  lines.push(
    `${stats.skuCount} SKU · inventario a costo ${stats.stockValue.toLocaleString("es-CR")} CRC · ${stats.healthyPct}% en banda saludable. InventarioIA solo recomienda; el humano aprueba.`,
  );
  if (urgent.length) {
    lines.push(
      `Comprar ya: ${urgent.map((m) => `${m.product.name} (${m.orderQty} ${m.product.unit})`).join("; ")}.`,
    );
  }
  if (exp.length) {
    lines.push(
      `Vencimientos críticos: ${exp.map((m) => `${m.product.name} (${m.daysToExpiry} d)`).join("; ")}.`,
    );
  }
  if (promo.length) {
    lines.push(
      `Rotación urgente: ${promo.map((m) => `${m.product.name} −${m.promo?.discount}%`).join("; ")}.`,
    );
  }
  const noBuy = metrics.filter((m) => m.orderAction === "no_comprar" || m.orderAction === "descontinuar").slice(0, 2);
  if (noBuy.length) {
    lines.push(`No reponer: ${noBuy.map((m) => m.product.name).join(", ")}.`);
  }
  return lines;
}

function consistencyNotes(metrics: ProductMetrics[]): string[] {
  const notes: string[] = [];
  for (const m of metrics) {
    const daily30 = m.sales30 / 30;
    const daily90 = m.avgDaily;
    if (daily90 < 0.05 && daily30 < 0.05) continue;
    const hi = Math.max(daily30, daily90);
    const lo = Math.min(daily30, daily90);
    if (hi > 0 && lo / hi < 0.5) {
      notes.push(
        `${m.product.sku}: rotación 30d (${daily30.toFixed(1)}/d) vs 90d (${daily90.toFixed(1)}/d) diverge >50%. Revisar ventana antes de comprar grande.`,
      );
    }
  }
  return notes.slice(0, 8);
}

function seasonalityNotes(today: string): string[] {
  const month = Number(today.slice(5, 7));
  if (month === 1 || month === 2) {
    return [
      "Calendario CR: regreso a clases. No hay histórico de eventos de Dyko — no se ajustó la rotación (promedio plano).",
    ];
  }
  if (month === 4 || month === 5) {
    return [
      "Calendario CR: Día de la Madre. No hay histórico Dyko — no se infló el pedido con un forecast estacional.",
    ];
  }
  if (month === 8 || month === 9) {
    return [
      "Calendario CR: Independencia (15 sep) y arranque de último trimestre. Sin histórico Dyko; rotación usada es promedio 90 d.",
    ];
  }
  if (month >= 10) {
    return [
      "Calendario CR: Navidad / fin de año. Rotación usada es promedio plano, no forecast estacional.",
    ];
  }
  return [];
}

export function buildReport(
  metrics: ProductMetrics[],
  mode: AgentMode = "cuidadoso",
  today = todayLocalIso(),
  coverage?: CatalogCoverage | null,
): InventoryReport {
  const stats = kpis(metrics);
  const view =
    mode === "rapido"
      ? metrics.filter(
          (m) =>
            m.orderAction === "comprar_ya" ||
            m.expiryNivel === "critico" ||
            m.status === "agotado" ||
            m.status === "vencido",
        )
      : metrics;

  const alertas = view
    .filter((m) => m.expiryNivel && (m.expiredQty > 0 || m.expiring60Qty > 0))
    .filter((m) => (mode === "rapido" ? m.expiryNivel === "critico" : true))
    .sort((a, b) => (a.daysToExpiry ?? 99) - (b.daysToExpiry ?? 99))
    .map((m) => ({
      sku: m.product.sku,
      producto: m.product.name,
      dias_para_vencer: m.daysToExpiry ?? 0,
      unidades_en_riesgo: m.expiredQty + (m.expiryNivel === "critico" ? m.expiring7Qty : m.expiring30Qty),
      nivel: m.expiryNivel as ExpiryNivel,
      sugerencia: {
        tipo: (m.promo?.tipo ?? "descuento") as PromoRec["tipo"],
        descuento_maximo_pct: m.promo?.descuento_maximo_pct ?? 0,
        margen_resultante_pct: m.promo?.margen_resultante_pct ?? round2(m.marginPct * 100),
        perdida_controlada: m.promo?.perdida_controlada ?? false,
        justificacion: m.promo?.justificacion ?? "Sin promoción; vigilar lote.",
        bundle: m.promo?.bundleName,
      },
    }));

  const compras = view
    .filter((m) =>
      mode === "rapido"
        ? m.orderAction === "comprar_ya"
        : true,
    )
    .map((m) => ({
      sku: m.product.sku,
      producto: m.product.name,
      clasificacion: m.orderAction,
      rotacion_mensual_promedio: m.rotacionMensual,
      dias_cobertura_actual: m.daysCover === null ? null : Math.round(m.daysCover),
      cantidad_sugerida: m.orderQty,
      justificacion: m.orderReason,
    }))
    .sort((a, b) => {
      const rank: Record<BuyClass, number> = {
        comprar_ya: 0,
        comprar_pronto: 1,
        vigilar: 2,
        no_comprar: 3,
        descontinuar: 4,
      };
      return rank[a.clasificacion] - rank[b.clasificacion];
    });

  const faltantes = [
    ...(coverage?.note ? [coverage.note] : []),
    "No hay conteo físico: merma/shrinkage no se puede calcular (stock teórico vs real).",
    "No hay historial de compras/proveedor: el lead time usado es el parametrizado por SKU, no el real observado.",
    "Estacionalidad: calendario genérico CR (Madre, Navidad, regreso a clases); no hay histórico de eventos de Dyko.",
    ...seasonalityNotes(today),
    ...metrics.flatMap((m) => m.datosFaltantes.map((d) => `${m.product.sku}: ${d}`)),
  ];
  if (mode === "verificado") faltantes.push(...consistencyNotes(metrics));

  const pasos = [
    "Revisar y aprobar (o rechazar) cada línea de comprar_ya antes de emitir OC.",
    "Aplicar FEFO y las promociones de vencimiento crítico esta semana.",
    "No reponer descontinuar / no_comprar aunque el proveedor ofrezca combo.",
  ];
  if (mode === "rapido") {
    pasos.splice(2, 1, "Corrida rápida: solo críticos. Correr modo cuidadoso para el plan semanal.");
  }

  const resumen = [
    `${stats.skuCount} SKU analizados · ${stats.healthyPct}% saludable · ${stats.crit} en quiebre · ${stats.over} en sobre-stock.`,
    alertas.filter((a) => a.nivel === "critico").length
      ? `${alertas.filter((a) => a.nivel === "critico").length} vencimientos críticos (≤7 d).`
      : "Sin vencimientos críticos hoy.",
    `${compras.filter((c) => c.clasificacion === "comprar_ya").length} líneas comprar_ya · ${compras.filter((c) => c.clasificacion === "comprar_pronto").length} comprar_pronto.`,
    "InventarioIA no ejecuta compras ni descuentos: el administrador aprueba.",
    mode === "rapido" ? "Modo rápido: solo alertas críticas." : mode === "verificado" ? "Modo verificado: incluye consistencia 30d vs 90d." : "Modo cuidadoso: reporte completo.",
  ].join(" ");

  return {
    fecha_analisis: today,
    modo: mode,
    resumen_ejecutivo: resumen,
    salud_general_inventario: {
      porcentaje_sano: stats.healthyPct,
      en_quiebre: stats.crit,
      en_sobre_stock: stats.over,
      total_skus_analizados: stats.skuCount,
      ...(coverage && coverage.total !== coverage.analyzed
        ? { total_skus_recibidos: coverage.total }
        : {}),
    },
    alertas_vencimiento: alertas,
    sugerencias_compra: mode === "rapido" ? compras.filter((c) => c.clasificacion === "comprar_ya") : compras,
    datos_faltantes_o_incertidumbre: [...new Set(faltantes)].slice(0, 16),
    proximos_pasos_para_el_usuario: pasos,
  };
}
