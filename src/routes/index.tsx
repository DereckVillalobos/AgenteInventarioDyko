import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { sendToAgent } from "@/components/agent/agent-panel";
import { PageGate } from "@/components/inventory/page-gate";
import { StatusBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SUGGESTIONS } from "@/lib/agent/store";
import { formatColon } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";
import { CATEGORY_LABEL, type Category } from "@/lib/inventory/types";

export const Route = createFileRoute("/")({ component: Home });

const QUICK = [
  { label: "Quiebres de stock", prompt: SUGGESTIONS[1] },
  { label: "Por vencer", prompt: SUGGESTIONS[2] },
  { label: "Qué pedir y qué no", prompt: SUGGESTIONS[3] },
  { label: "Qué promocionar", prompt: SUGGESTIONS[4] },
];

function Home() {
  return (
    <AppShell
      title="Panel de bodega"
      subtitle="InventarioIA vigila existencias, vencimientos y rotación. Propone compras y promociones; tú apruebas."
    >
      <PageGate>
        <Dashboard />
      </PageGate>
    </AppShell>
  );
}

function Dashboard() {
  const { kpis: stats, alerts, briefing, metrics, snapshot, mode, report } = useAnalysis();
  if (!stats) return null;

  const byCat = new Map<Category, { n: number; healthy: number }>();
  for (const m of metrics) {
    const cur = byCat.get(m.product.category) ?? { n: 0, healthy: 0 };
    cur.n += 1;
    if (m.status === "saludable") cur.healthy += 1;
    byCat.set(m.product.category, cur);
  }

  const tiles = [
    { label: "Valor a costo", value: formatColon(stats.stockValue), hint: `${stats.skuCount} SKU` },
    { label: "Críticos / agotados", value: String(stats.crit), hint: "Requieren pedido" },
    { label: "Por vencer (30 d)", value: String(stats.expiring), hint: "FEFO y promoción" },
    { label: "Pedido sugerido", value: formatColon(stats.orderValue), hint: `${stats.orderLines} líneas` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-xs tracking-wide text-muted uppercase">{t.label}</p>
              <p className="mt-2 font-display text-3xl tracking-tight tabular-nums">{t.value}</p>
              <p className="mt-1 text-xs text-subtle">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <p className="text-xs tracking-wide text-muted uppercase">Briefing de InventarioIA</p>
            <ul className="mt-3 space-y-2">
              {briefing.map((line) => (
                <li key={line} className="border-l-2 border-accent pl-3 text-sm">
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK.map((s) => (
                <Button key={s.label} variant="outline" size="sm" onClick={() => sendToAgent(s.prompt, snapshot, mode)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="text-xs tracking-wide text-muted uppercase">Salud por categoría</p>
            <ul className="mt-3 space-y-2.5">
              {[...byCat.entries()].map(([cat, v]) => {
                const pct = Math.round((v.healthy / v.n) * 100);
                return (
                  <li key={cat}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{CATEGORY_LABEL[cat]}</span>
                      <span className="tabular-nums text-muted">
                        {v.healthy}/{v.n}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-warm">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>

      {report ? (
        <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs tracking-wide text-muted uppercase">Reporte {report.modo} · {report.fecha_analisis}</p>
            <CopyJson json={report} />
          </div>
          <p className="text-sm leading-relaxed">{report.resumen_ejecutivo}</p>
          {report.datos_faltantes_o_incertidumbre.length ? (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {report.datos_faltantes_o_incertidumbre.slice(0, 3).map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl tracking-tight">Alertas</h2>
          <Link to="/inventario" className="text-sm text-muted hover:text-fg">
            Ver inventario
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {alerts.length === 0 ? (
            <p className="p-5 text-sm text-muted">Sin alertas. Bodega en banda saludable.</p>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.slice(0, 8).map((a) => {
                const m = metrics.find((x) => x.product.sku === a.sku);
                return (
                  <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted">{a.detail}</p>
                    </div>
                    {m ? <StatusBadge status={m.status} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function CopyJson({ json }: { json: unknown }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
        setDone(true);
        window.setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "JSON copiado" : "Copiar JSON Dyko"}
    </Button>
  );
}
