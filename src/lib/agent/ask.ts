import { createServerFn } from "@tanstack/react-start";
import { analyzeSnapshots, briefing, buildAlerts, kpis } from "@/lib/inventory/analytics";
import type { CatalogSnapshot, ProductMetrics } from "@/lib/inventory/types";
import { CATEGORY_LABEL } from "@/lib/inventory/types";
import { formatColon, formatQty, todayLocalIso } from "@/lib/inventory/format";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ToolTrace = { name: string; summary: string };

type AskInput = {
  messages: ChatTurn[];
  catalog: CatalogSnapshot[];
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "overview",
      description:
        "Resumen del inventario: KPIs, alertas y briefing. Úsalo primero para situarte.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description:
        "Lista SKU filtrados por estado, categoría, rotación ABC, velocidad o texto.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nombre, marca o SKU" },
          status: {
            type: "string",
            enum: ["agotado", "critico", "bajo", "saludable", "exceso", "vence", "vencido"],
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
      description: "Detalle de un SKU: stock, lotes, rotación, pedido y promoción.",
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
      description: "Lotes vencidos o que vencen dentro de N días (FEFO).",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Ventana en días. Default 14." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "purchase_plan",
      description: "Qué pedir, qué no pedir y por qué, con cantidades y costo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "promo_plan",
      description: "Productos a promocionar por vencimiento o baja rotación.",
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
    daysCover: m.daysCover === null ? null : Math.round(m.daysCover),
    abc: m.abc,
    velocity: m.velocity,
    status: m.status,
    expiry: m.nearestExpiry,
    daysToExpiry: m.daysToExpiry,
    order: m.orderAction,
    orderQty: m.orderQty,
    orderReason: m.orderReason,
    promo: m.promo,
    stockValue: Math.round(m.stockValue),
    cost: p.cost,
    price: p.price,
  };
}

function runTool(
  name: string,
  rawArgs: string,
  metrics: ProductMetrics[],
): { result: unknown; summary: string } {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  if (name === "overview") {
    const stats = kpis(metrics);
    const alerts = buildAlerts(metrics).slice(0, 12);
    return {
      summary: "Resumen general",
      result: {
        today: todayLocalIso(),
        kpis: {
          ...stats,
          stockValue: formatColon(stats.stockValue),
          orderValue: formatColon(stats.orderValue),
        },
        briefing: briefing(metrics),
        alerts,
      },
    };
  }

  if (name === "list_products") {
    const query = String(args.query ?? "").toLowerCase();
    const status = args.status as string | undefined;
    const category = args.category as string | undefined;
    const abc = args.abc as string | undefined;
    const velocity = args.velocity as string | undefined;
    const limit = Math.min(Number(args.limit ?? 20), 40);
    const rows = metrics.filter((m) => {
      const p = m.product;
      if (status && m.status !== status) return false;
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
    if (!m) return { summary: "No encontrado", result: { error: "SKU no encontrado" } };
    return {
      summary: m.product.sku,
      result: {
        ...compactMetric(m),
        lots: m.product.lots,
        sales7: m.sales7,
        sales30: m.sales30,
        sales90: m.sales90,
      },
    };
  }

  if (name === "expiries") {
    const days = Number(args.days ?? 14);
    const rows = metrics
      .filter((m) => m.expiredQty > 0 || (m.daysToExpiry !== null && m.daysToExpiry <= days))
      .sort((a, b) => (a.daysToExpiry ?? -99) - (b.daysToExpiry ?? -99))
      .map((m) => ({
        ...compactMetric(m),
        lots: m.product.lots,
        expiredQty: m.expiredQty,
        expiring14Qty: m.expiring14Qty,
      }));
    return { summary: `${rows.length} con vencimiento`, result: rows };
  }

  if (name === "purchase_plan") {
    const pedir = metrics
      .filter((m) => m.orderAction !== "no_pedir")
      .sort((a, b) => {
        if (a.orderAction !== b.orderAction) return a.orderAction === "urgente" ? -1 : 1;
        return b.orderQty * b.product.cost - a.orderQty * a.product.cost;
      })
      .map((m) => ({
        ...compactMetric(m),
        lineCost: m.orderQty * m.product.cost,
      }));
    const noPedir = metrics
      .filter(
        (m) =>
          m.orderAction === "no_pedir" && (m.status === "exceso" || m.velocity === "muerta" || m.promo),
      )
      .slice(0, 15)
      .map((m) => compactMetric(m));
    const total = pedir.reduce((s, r) => s + r.lineCost, 0);
    return {
      summary: `${pedir.length} líneas a pedir`,
      result: {
        totalCosto: formatColon(total),
        pedir,
        noPedir,
      },
    };
  }

  if (name === "promo_plan") {
    const rows = metrics
      .filter((m) => m.promo)
      .sort((a, b) => {
        const rank = { alta: 0, media: 1, baja: 2 };
        return rank[a.promo!.urgency] - rank[b.promo!.urgency];
      })
      .map((m) => ({
        ...compactMetric(m),
        suggestedPrice: Math.round(m.product.price * (1 - m.promo!.discount / 100)),
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
      temperature: 0.25,
      max_tokens: 1400,
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

    const metrics = analyzeSnapshots(data.catalog.slice(0, 80));
    const today = todayLocalIso();

    const system = `Eres DARA, el agente de inventario de Dyko (comercio en Puntarenas, Costa Rica).
Hoy es ${today}. Moneda: colones costarricenses (CRC).
Hablas español, claro y operativo. No uses emojis.

Reglas:
- Consulta SIEMPRE las herramientas antes de afirmar cifras. No inventes SKU, existencias ni fechas.
- Sé concreto: SKU, cantidad, unidad, fecha, colones, acción (pedir / no pedir / promocionar / dar de baja).
- Stock saludable = banda entre mínimo y el objetivo calculado por rotación y vida útil.
- Prioriza FEFO en perecederos. No recomiendes pedir si hay lote por vencer que cubre la demanda.
- Productos de rotación muerta o excesos: no pedir; sugerir promoción o discontinuación.
- Si faltan datos, dilo. Máximo 8 viñetas o una tabla corta. Cierra con 1-3 acciones de hoy.`;

    const history = data.messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    })) as OaiMessage[];

    const messages: OaiMessage[] = [{ role: "system", content: system }, ...history];
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
          const ran = runTool(call.function.name, call.function.arguments, metrics);
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
