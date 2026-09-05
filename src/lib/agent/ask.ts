import { createServerFn } from "@tanstack/react-start";
import { analyzeSnapshots, briefing, buildAlerts, buildReport, kpis } from "@/lib/inventory/analytics";
import type { AgentMode, CatalogSnapshot, ProductMetrics } from "@/lib/inventory/types";
import { CATEGORY_LABEL, DEFAULT_PARAMS } from "@/lib/inventory/types";
import { formatColon, formatQty, todayLocalIso } from "@/lib/inventory/format";
import { analyzeShrinkage, buildShrinkageReport, shrinkageKpis } from "@/lib/shrinkage/analytics";
import type { PhysicalCount } from "@/lib/shrinkage/types";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ToolTrace = { name: string; summary: string };
export type AgentDomain = "inventario" | "merma";

type AskInput = {
  messages: ChatTurn[];
  catalog: CatalogSnapshot[];
  mode?: AgentMode;
  domain?: AgentDomain;
  counts?: PhysicalCount[];
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "reporte_inventario",
      description:
        "Reporte JSON completo para Dyko: salud, vencimientos 7/30/60, sugerencias de compra (comprar_ya|comprar_pronto|no_comprar|descontinuar|vigilar) y datos faltantes. Úsalo primero en dominio inventario.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "overview",
      description: "KPIs, alertas y briefing breve de inventario.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description: "Lista SKU filtrados por estado, categoría, ABC, velocidad, clasificación de compra o texto.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: {
            type: "string",
            enum: ["agotado", "critico", "bajo", "saludable", "exceso", "vence", "vencido"],
          },
          clasificacion: {
            type: "string",
            enum: ["comprar_ya", "comprar_pronto", "no_comprar", "descontinuar", "vigilar"],
          },
          category: { type: "string" },
          abc: { type: "string", enum: ["A", "B", "C"] },
          velocity: { type: "string", enum: ["alta", "media", "baja", "muerta"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "product_detail",
      description: "Detalle de un SKU: stock, lotes, rotación, compra y promoción (con margen).",
      parameters: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expiries",
      description: "Lotes vencidos o que vencen dentro de N días. Default 30 (alerta). Crítico=7, vigilar=60.",
      parameters: {
        type: "object",
        properties: { days: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "purchase_plan",
      description: "Sugerencias de compra por clasificación, con cantidad y justificación numérica. No ejecuta OC.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "promo_plan",
      description:
        "Promociones por vencimiento o rotación muerta. Incluye descuento máximo que preserva margen mínimo y si es pérdida controlada.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "healthy_stock",
      description: "Stock objetivo vs actual por categoría o SKU.",
      parameters: {
        type: "object",
        properties: { category: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reporte_merma",
      description:
        "Reporte JSON de MermaIA: cobertura de conteo, valor de merma/sobrante, discrepancias (posible_hurto|merma_operativa|error_probable_conteo|sobrante|sin_conteo). No ajusta stock. Úsalo primero en dominio merma.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "discrepancias",
      description: "Lista líneas de merma filtradas por clasificación.",
      parameters: {
        type: "object",
        properties: {
          clasificacion: {
            type: "string",
            enum: [
              "cuadrado",
              "merma_operativa",
              "posible_hurto",
              "error_probable_conteo",
              "sobrante",
              "merma_no_clasificada",
              "sin_conteo",
            ],
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "merma_detail",
      description: "Detalle de merma de un SKU: teórico, físico, causa propuesta. Si no hay conteo, lo declara.",
      parameters: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    },
  },
] as const;

function compactMetric(m: ProductMetrics) {
  const p = m.product;
  return {
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: CATEGORY_LABEL[p.category],
    unit: p.unit,
    stock: p.stock,
    min: p.minStock,
    max: p.maxStock,
    target: m.targetStock,
    avgDaily: Number(m.avgDaily.toFixed(2)),
    rotacionMensual: m.rotacionMensual,
    tendencia: m.tendencia,
    daysCover: m.daysCover === null ? null : Math.round(m.daysCover),
    abc: m.abc,
    velocity: m.velocity,
    status: m.status,
    clasificacion: m.orderAction,
    expiry: m.nearestExpiry,
    daysToExpiry: m.daysToExpiry,
    expiryNivel: m.expiryNivel,
    orderQty: m.orderQty,
    orderReason: m.orderReason,
    promo: m.promo,
    stockValue: Math.round(m.stockValue),
    margenPct: Math.round(m.marginPct * 100),
    cost: p.cost,
    price: p.price,
    datosFaltantes: m.datosFaltantes,
  };
}

function runTool(
  name: string,
  rawArgs: string,
  metrics: ProductMetrics[],
  mode: AgentMode,
  counts: PhysicalCount[],
): { result: unknown; summary: string } {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  const shrinkRows = analyzeShrinkage(metrics, counts);

  if (name === "reporte_merma") {
    const report = buildShrinkageReport(shrinkRows);
    return { summary: `Merma ${report.cobertura_conteo.porcentaje}%`, result: report };
  }

  if (name === "discrepancias") {
    const clasificacion = args.clasificacion as string | undefined;
    const limit = Math.min(Number(args.limit ?? 20), 40);
    const rows = shrinkRows.filter((r) => (clasificacion ? r.clasificacion === clasificacion : r.clasificacion !== "cuadrado"));
    return { summary: `${rows.length} líneas`, result: rows.slice(0, limit) };
  }

  if (name === "merma_detail") {
    const sku = String(args.sku ?? "").toLowerCase();
    const row =
      shrinkRows.find((x) => x.sku.toLowerCase() === sku) ??
      shrinkRows.find((x) => x.producto.toLowerCase().includes(sku));
    if (!row) return { summary: "No encontrado", result: { error: "SKU no encontrado", dato_faltante: true } };
    return { summary: row.sku, result: row };
  }

  if (name === "reporte_inventario") {
    const report = buildReport(metrics, mode);
    return { summary: `Reporte ${mode}`, result: report };
  }

  if (name === "overview") {
    const stats = kpis(metrics);
    const alerts = buildAlerts(metrics).slice(0, 12);
    const sk = shrinkageKpis(shrinkRows);
    return {
      summary: "Resumen general",
      result: {
        today: todayLocalIso(),
        modo: mode,
        margenMinimo: `${Math.round(DEFAULT_PARAMS.margenMinimo * 100)}%`,
        kpis: {
          ...stats,
          stockValue: formatColon(stats.stockValue),
          orderValue: formatColon(stats.orderValue),
        },
        merma: {
          cobertura: `${sk.coveragePct}%`,
          valorMerma: formatColon(sk.valorMerma),
          hurto: sk.hurto,
          sinConteo: sk.sinConteo,
        },
        briefing: briefing(metrics),
        alerts,
      },
    };
  }

  if (name === "list_products") {
    const query = String(args.query ?? "").toLowerCase();
    const status = args.status as string | undefined;
    const clasificacion = args.clasificacion as string | undefined;
    const category = args.category as string | undefined;
    const abc = args.abc as string | undefined;
    const velocity = args.velocity as string | undefined;
    const limit = Math.min(Number(args.limit ?? 20), 40);
    const rows = metrics.filter((m) => {
      const p = m.product;
      if (status && m.status !== status) return false;
      if (clasificacion && m.orderAction !== clasificacion) return false;
      if (
        category &&
        p.category !== category &&
        CATEGORY_LABEL[p.category].toLowerCase() !== category.toLowerCase()
      )
        return false;
      if (abc && m.abc !== abc) return false;
      if (velocity && m.velocity !== velocity) return false;
      if (query && !`${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(query)) return false;
      return true;
    });
    return {
      summary: `${rows.length} productos`,
      result: rows.slice(0, limit).map(compactMetric),
    };
  }

  if (name === "product_detail") {
    const sku = String(args.sku ?? "").toLowerCase();
    const m =
      metrics.find((x) => x.product.sku.toLowerCase() === sku) ??
      metrics.find((x) => x.product.name.toLowerCase().includes(sku));
    if (!m) return { summary: "No encontrado", result: { error: "SKU no encontrado", dato_faltante: true } };
    const shrink = shrinkRows.find((r) => r.sku === m.product.sku);
    return {
      summary: m.product.sku,
      result: {
        ...compactMetric(m),
        lots: m.product.lots,
        sales7: m.sales7,
        sales30: m.sales30,
        sales30Prev: m.sales30Prev,
        sales30Old: m.sales30Old,
        sales90: m.sales90,
        merma: shrink ?? { dato_faltante: true },
      },
    };
  }

  if (name === "expiries") {
    const days = Number(args.days ?? DEFAULT_PARAMS.vencimientoAlertaDias);
    const rows = metrics
      .filter((m) => m.expiredQty > 0 || (m.daysToExpiry !== null && m.daysToExpiry <= days))
      .sort((a, b) => (a.daysToExpiry ?? -99) - (b.daysToExpiry ?? -99))
      .map((m) => ({
        ...compactMetric(m),
        lots: m.product.lots,
        expiredQty: m.expiredQty,
        expiring7Qty: m.expiring7Qty,
        expiring30Qty: m.expiring30Qty,
        expiring60Qty: m.expiring60Qty,
      }));
    return { summary: `${rows.length} con vencimiento`, result: rows };
  }

  if (name === "purchase_plan") {
    const groups = {
      comprar_ya: metrics.filter((m) => m.orderAction === "comprar_ya"),
      comprar_pronto: metrics.filter((m) => m.orderAction === "comprar_pronto"),
      no_comprar: metrics.filter((m) => m.orderAction === "no_comprar"),
      descontinuar: metrics.filter((m) => m.orderAction === "descontinuar"),
      vigilar: metrics.filter((m) => m.orderAction === "vigilar"),
    };
    const pedir = [...groups.comprar_ya, ...groups.comprar_pronto];
    const total = pedir.reduce((s, m) => s + m.orderQty * m.product.cost, 0);
    return {
      summary: `${groups.comprar_ya.length} comprar_ya`,
      result: {
        nota: "Propuestas para aprobación humana. InventarioIA no emite órdenes de compra.",
        totalCostoSugerido: formatColon(total),
        comprar_ya: groups.comprar_ya.map((m) => ({ ...compactMetric(m), lineCost: m.orderQty * m.product.cost })),
        comprar_pronto: groups.comprar_pronto.map((m) => ({
          ...compactMetric(m),
          lineCost: m.orderQty * m.product.cost,
        })),
        no_comprar: groups.no_comprar.slice(0, 12).map(compactMetric),
        descontinuar: groups.descontinuar.map(compactMetric),
        vigilar: groups.vigilar.slice(0, 8).map(compactMetric),
      },
    };
  }

  if (name === "promo_plan") {
    const rank = { critico: 0, alerta: 1, vigilar: 2 };
    const rows = metrics
      .filter((m) => m.promo)
      .sort((a, b) => rank[a.promo!.urgency] - rank[b.promo!.urgency])
      .map((m) => ({
        ...compactMetric(m),
        suggestedPrice: Math.round(m.product.price * (1 - m.promo!.discount / 100)),
        margenMinimo: Math.round(DEFAULT_PARAMS.margenMinimo * 100),
      }));
    return { summary: `${rows.length} promociones`, result: rows };
  }

  if (name === "healthy_stock") {
    const category = args.category as string | undefined;
    const rows = metrics.filter((m) => {
      if (!category) return true;
      return (
        m.product.category === category ||
        CATEGORY_LABEL[m.product.category].toLowerCase() === category.toLowerCase()
      );
    });
    const byCat: Record<string, { sku: number; over: number; under: number; ok: number }> = {};
    for (const m of rows) {
      const key = CATEGORY_LABEL[m.product.category];
      byCat[key] ??= { sku: 0, over: 0, under: 0, ok: 0 };
      byCat[key].sku += 1;
      if (m.product.stock > m.targetStock * 1.15) byCat[key].over += 1;
      else if (m.product.stock < m.targetStock * 0.85) byCat[key].under += 1;
      else byCat[key].ok += 1;
    }
    return {
      summary: "Stock saludable",
      result: {
        categories: byCat,
        items: rows.slice(0, 30).map((m) => ({
          sku: m.product.sku,
          name: m.product.name,
          stock: formatQty(m.product.stock, m.product.unit),
          target: formatQty(m.targetStock, m.product.unit),
          gap: m.product.stock - m.targetStock,
          status: m.status,
          clasificacion: m.orderAction,
        })),
      },
    };
  }

  return { summary: "Herramienta desconocida", result: { error: `Unknown tool ${name}` } };
}

type OaiMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

async function complete(apiKey: string, messages: OaiMessage[]) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: 1600,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as {
    choices: { message: OaiMessage & { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
}

function systemPrompt(today: string, mode: AgentMode, domain: AgentDomain, minM: number) {
  const merma = `Eres MermaIA, agente hermano de InventarioIA en Dyko Intelligence (Puntarenas, Costa Rica).
Hoy es ${today}. Moneda: colones (CRC).
Hablas español, claro y operativo. Sin emojis.

No ejecutas nada: no ajustas el teórico, no das de baja, no acusas. Solo propones; el humano aprueba.

Reglas:
- Llama reporte_merma o discrepancias antes de afirmar cifras. No inventes conteos.
- Si un SKU no tiene conteo físico, clasifícalo sin_conteo y decláralo. Nunca estimes la merma.
- posible_hurto es hipótesis (faltante alto en no perecedero sin vencimiento). No es sentencia.
- merma_operativa: perecedero / vencido. error_probable_conteo: 1 unidad de más o de menos en stock grande.
- Respuesta: 3–5 líneas + SKU, diferencia, colones, acción a aprobar.
- Cierra con 1–3 pasos de hoy.`;

  const inv = `Eres InventarioIA, analista senior de inventario de Dyko Intelligence (Puntarenas, Costa Rica).
Hoy es ${today}. Moneda: colones (CRC). Modo: ${mode}.
Margen mínimo aceptable: ${minM}%. Ventanas de vencimiento: crítico ≤7 d, alerta ≤30 d, vigilar ≤60 d.
Hablas español, claro y operativo. Sin emojis.

No ejecutas nada: no emites órdenes de compra ni aplicas descuentos. Solo propones; el humano aprueba.

Reglas:
- Llama herramientas antes de afirmar cifras. No inventes SKU, existencias, fechas ni porcentajes.
- Si falta un dato, decláralo en "datos faltantes". Nunca rellenes con supuestos.
- Clasificación de compra: comprar_ya | comprar_pronto | no_comprar | descontinuar | vigilar.
- Cantidad sugerida = rotación diaria × (lead time + stock de seguridad) − stock actual.
- Quiebre inminente: días de cobertura < lead time del proveedor.
- Sobre-stock: cobertura > 90 días.
- Descuento: nunca bajes el margen por debajo de ${minM}% salvo "pérdida controlada por vencimiento inminente" con justificación.
- FEFO en perecederos. No pedir si el lote actual cubre la demanda.
- Modo rápido: solo quiebre inminente y vencimiento ≤7 d.
- Modo cuidadoso: reporte completo.
- Modo verificado: compara ventanas 30 d vs 90 d y señala divergencias.
- Merma/conteo físico es el agente hermano MermaIA (herramientas reporte_merma, discrepancias). No mezcles merma con la OC.
- Respuesta al usuario: resumen 3–5 líneas + acciones concretas (SKU, cantidad, colones).
- Cierra con 1–3 pasos que el administrador debe aprobar hoy.`;

  return domain === "merma" ? merma : inv;
}

export const askInventoryAgent = createServerFn({ method: "POST" })
  .validator((input: AskInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "El agente no está disponible en este entorno.",
      };
    }

    const mode: AgentMode = data.mode ?? "cuidadoso";
    const domain: AgentDomain = data.domain ?? "inventario";
    const counts = data.counts ?? [];
    const metrics = analyzeSnapshots(data.catalog.slice(0, 80));
    const today = todayLocalIso();
    const minM = Math.round(DEFAULT_PARAMS.margenMinimo * 100);

    const history = data.messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    })) as OaiMessage[];

    const messages: OaiMessage[] = [
      { role: "system", content: systemPrompt(today, mode, domain, minM) },
      ...history,
    ];
    const traces: ToolTrace[] = [];

    try {
      for (let round = 0; round < 5; round++) {
        const json = await complete(apiKey, messages);
        const msg = json.choices[0]?.message;
        if (!msg) {
          return { ok: false as const, error: "El agente no respondió." };
        }
        const calls = msg.tool_calls ?? [];
        if (!calls.length) {
          const text = (msg.content ?? "").trim();
          return {
            ok: true as const,
            text: text || "No pude armar una respuesta. Prueba de nuevo.",
            traces,
          };
        }
        messages.push({
          role: "assistant",
          content: msg.content ?? null,
          tool_calls: calls,
        });
        for (const call of calls) {
          const ran = runTool(call.function.name, call.function.arguments, metrics, mode, counts);
          traces.push({ name: call.function.name, summary: ran.summary });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(ran.result),
          });
        }
      }
      return {
        ok: true as const,
        text: "Consulté el inventario pero necesito que reformules la pregunta para cerrar la respuesta.",
        traces,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error del agente";
      return { ok: false as const, error: message };
    }
  });
