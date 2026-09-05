import { todayLocalIso } from "@/lib/inventory/format";
import type { ProductMetrics } from "@/lib/inventory/types";
import type {
  PhysicalCount,
  ShrinkAction,
  ShrinkClass,
  ShrinkParams,
  ShrinkageReport,
  ShrinkageRow,
} from "./types";
import { DEFAULT_SHRINK_PARAMS } from "./types";

function classify(args: {
  teorico: number;
  fisico: number | null;
  cost: number;
  perishable: boolean;
  expiredQty: number;
  daysToExpiry: number | null;
  params: ShrinkParams;
}): { clasificacion: ShrinkClass; accion: ShrinkAction; justificacion: string } {
  const { teorico, fisico, cost, perishable, expiredQty, daysToExpiry, params } = args;
  if (fisico === null) {
    return {
      clasificacion: "sin_conteo",
      accion: "contar",
      justificacion: "No hay conteo físico de este SKU. No se estima merma: dato faltante.",
    };
  }

  const delta = fisico - teorico;
  if (delta === 0) {
    return {
      clasificacion: "cuadrado",
      accion: "ninguna",
      justificacion: `Teórico y físico coinciden (${teorico}).`,
    };
  }

  if (delta > 0) {
    if (delta <= params.errorConteoUnidades) {
      return {
        clasificacion: "error_probable_conteo",
        accion: "recontar",
        justificacion: `Sobra ${delta} vs teórico ${teorico}. Una unidad de más suele ser error de conteo o recepción no ingresada. Recontar antes de ajustar.`,
      };
    }
    return {
      clasificacion: "sobrante",
      accion: "ajustar_teorico",
      justificacion: `Físico ${fisico} > teórico ${teorico} (+${delta}). Posible recepción no registrada. Ajustar solo si el reconteo confirma.`,
    };
  }

  const missing = -delta;
  const value = missing * cost;
  const pct = teorico > 0 ? missing / teorico : 1;

  if (expiredQty > 0 && missing <= expiredQty + 1) {
    return {
      clasificacion: "merma_operativa",
      accion: "dar_de_baja",
      justificacion: `Faltan ${missing}. Hay ${expiredQty} vencidos en lote FEFO: merma por vencimiento, no hurto. Dar de baja requiere aprobación.`,
    };
  }

  if (perishable && daysToExpiry !== null && daysToExpiry <= 7 && pct <= 0.4) {
    return {
      clasificacion: "merma_operativa",
      accion: "dar_de_baja",
      justificacion: `Faltan ${missing} en perecedero que vence en ${daysToExpiry} d. Merma operativa probable (rotura/vencimiento). Aprobación para baja.`,
    };
  }

  if (perishable && missing <= 3 && pct <= 0.25) {
    return {
      clasificacion: "merma_operativa",
      accion: "dar_de_baja",
      justificacion: `Faltan ${missing} en perecedero (${Math.round(pct * 100)}% del teórico). Merma operativa chica. Confirmar y dar de baja.`,
    };
  }

  if (!perishable && value >= params.hurtoValorMinimo && pct >= params.hurtoPctMinimo) {
    return {
      clasificacion: "posible_hurto",
      accion: "investigar",
      justificacion: `Faltan ${missing} (${Math.round(pct * 100)}% · ${value.toLocaleString("es-CR")} CRC) en no perecedero. No hay lote vencido que lo explique. Investigar y recontar; no ajustar aún.`,
    };
  }

  if (missing <= params.errorConteoUnidades && teorico >= 10) {
    return {
      clasificacion: "error_probable_conteo",
      accion: "recontar",
      justificacion: `Falta ${missing} sobre teórico ${teorico}. Dentro de tolerancia de conteo. Recontar antes de dar de baja.`,
    };
  }

  return {
    clasificacion: "merma_no_clasificada",
    accion: "investigar",
    justificacion: `Faltan ${missing} (${value.toLocaleString("es-CR")} CRC). No hay señal clara de vencimiento ni de hurto. No se asume causa.`,
  };
}

export function analyzeShrinkage(
  metrics: ProductMetrics[],
  counts: PhysicalCount[],
  params: ShrinkParams = DEFAULT_SHRINK_PARAMS,
): ShrinkageRow[] {
  const bySku = new Map(counts.map((c) => [c.sku, c]));
  return metrics.map((m) => {
    const p = m.product;
    const count = bySku.get(p.sku);
    const fisico = count ? count.countedQty : null;
    const delta = fisico === null ? null : fisico - p.stock;
    const missing = delta !== null && delta < 0 ? -delta : 0;
    const extra = delta !== null && delta > 0 ? delta : 0;
    const valor = (missing + extra) * p.cost;
    const cls = classify({
      teorico: p.stock,
      fisico,
      cost: p.cost,
      perishable: p.perishable,
      expiredQty: m.expiredQty,
      daysToExpiry: m.daysToExpiry,
      params,
    });
    const faltantes: string[] = [];
    if (!count) faltantes.push("sin conteo físico");
    return {
      sku: p.sku,
      producto: p.name,
      unit: p.unit,
      cost: p.cost,
      stockTeorico: p.stock,
      stockFisico: fisico,
      diferencia: delta,
      valorCrc: Math.round(valor),
      clasificacion: cls.clasificacion,
      justificacion: cls.justificacion,
      accion_sugerida: cls.accion,
      countedBy: count?.countedBy ?? null,
      countedAt: count?.countedAt ?? null,
      perishable: p.perishable,
      expiredQty: m.expiredQty,
      datosFaltantes: faltantes,
    };
  });
}

export function shrinkageKpis(rows: ShrinkageRow[]) {
  const counted = rows.filter((r) => r.clasificacion !== "sin_conteo");
  const merma = rows.filter(
    (r) =>
      r.diferencia !== null &&
      r.diferencia < 0 &&
      r.clasificacion !== "error_probable_conteo",
  );
  const sobrante = rows.filter((r) => r.clasificacion === "sobrante" || (r.diferencia !== null && r.diferencia > 0));
  const hurto = rows.filter((r) => r.clasificacion === "posible_hurto");
  const sin = rows.filter((r) => r.clasificacion === "sin_conteo");
  const valorMerma = merma.reduce((s, r) => s + (r.diferencia !== null && r.diferencia < 0 ? -r.diferencia * r.cost : 0), 0);
  const valorSobrante = sobrante.reduce((s, r) => s + (r.diferencia !== null && r.diferencia > 0 ? r.diferencia * r.cost : 0), 0);
  return {
    skuCount: rows.length,
    counted: counted.length,
    coveragePct: rows.length ? Math.round((counted.length / rows.length) * 100) : 0,
    discrepancias: counted.filter((r) => r.clasificacion !== "cuadrado").length,
    hurto: hurto.length,
    sinConteo: sin.length,
    valorMerma: Math.round(valorMerma),
    valorSobrante: Math.round(valorSobrante),
  };
}

export function buildShrinkageReport(
  rows: ShrinkageRow[],
  today = todayLocalIso(),
): ShrinkageReport {
  const stats = shrinkageKpis(rows);
  const fechas = rows.map((r) => r.countedAt).filter((d): d is string => !!d);
  const fechaConteo = fechas.sort()[0] ?? null;
  const disc = rows
    .filter((r) => r.clasificacion !== "cuadrado")
    .sort((a, b) => {
      const rank: Record<ShrinkClass, number> = {
        posible_hurto: 0,
        merma_operativa: 1,
        merma_no_clasificada: 2,
        sobrante: 3,
        error_probable_conteo: 4,
        sin_conteo: 5,
        cuadrado: 6,
      };
      return rank[a.clasificacion] - rank[b.clasificacion] || b.valorCrc - a.valorCrc;
    })
    .map((r) => ({
      sku: r.sku,
      producto: r.producto,
      stock_teorico: r.stockTeorico,
      stock_fisico: r.stockFisico,
      diferencia: r.diferencia,
      valor_crc: r.valorCrc,
      clasificacion: r.clasificacion,
      justificacion: r.justificacion,
      accion_sugerida: r.accion_sugerida,
    }));

  const faltantes = [
    `Conteo cubre ${stats.counted}/${stats.skuCount} SKU (${stats.coveragePct}%). El resto es dato faltante: no se inventa merma.`,
    "No hay cámaras ni bitácora de mermas diarias: posible_hurto es hipótesis, no sentencia.",
    ...rows.flatMap((r) => r.datosFaltantes.map((d) => `${r.sku}: ${d}`)).slice(0, 8),
  ];

  const pasos = [
    "Recontar los SKU en posible_hurto y error_probable_conteo antes de tocar el teórico.",
    "Aprobar (o rechazar) las bajas de merma_operativa. MermaIA no ajusta existencias.",
    "Completar el conteo de los SKU sin_conteo en el próximo ciclo.",
  ];

  const resumen = [
    `Conteo ${stats.coveragePct}% del catálogo (${stats.counted}/${stats.skuCount} SKU).`,
    `${stats.discrepancias} discrepancias · merma ${stats.valorMerma.toLocaleString("es-CR")} CRC · sobrante ${stats.valorSobrante.toLocaleString("es-CR")} CRC.`,
    stats.hurto ? `${stats.hurto} líneas posible_hurto: investigar, no ajustar.` : "Sin hipótesis de hurto en este ciclo.",
    `${stats.sinConteo} SKU sin conteo: no se estima merma ahí.`,
    "MermaIA no ejecuta ajustes: el administrador aprueba.",
  ].join(" ");

  return {
    fecha_analisis: today,
    fecha_conteo: fechaConteo,
    resumen_ejecutivo: resumen,
    cobertura_conteo: {
      skus_teoricos: stats.skuCount,
      skus_contados: stats.counted,
      porcentaje: stats.coveragePct,
    },
    valor_merma_crc: stats.valorMerma,
    valor_sobrante_crc: stats.valorSobrante,
    discrepancias: disc,
    datos_faltantes_o_incertidumbre: [...new Set(faltantes)].slice(0, 16),
    proximos_pasos_para_el_usuario: pasos,
  };
}
