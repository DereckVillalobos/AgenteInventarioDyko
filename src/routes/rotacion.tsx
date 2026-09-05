import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageGate } from "@/components/inventory/page-gate";
import { AbcBadge, VelocityBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { formatColon, formatQty } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";

export const Route = createFileRoute("/rotacion")({ component: RotacionPage });

function RotacionPage() {
  return (
    <AppShell
      title="Rotación"
      subtitle="Clase ABC por venta a 90 días y velocidad diaria. Lo lento no se repone."
    >
      <PageGate>
        <RotationBoard />
      </PageGate>
    </AppShell>
  );
}

function RotationBoard() {
  const { metrics } = useAnalysis();
  const abc = ["A", "B", "C"].map((k) => ({
    clase: k,
    sku: metrics.filter((m) => m.abc === k).length,
    venta: Math.round(
      metrics.filter((m) => m.abc === k).reduce((s, m) => s + m.sales90 * m.product.price, 0),
    ),
  }));
  const top = [...metrics].sort((a, b) => b.avgDaily - a.avgDaily).slice(0, 6);
  const slow = [...metrics]
    .filter((m) => m.velocity === "baja" || m.velocity === "muerta")
    .sort((a, b) => (b.daysCover ?? 0) - (a.daysCover ?? 0))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <p className="mb-3 text-xs tracking-wide text-muted uppercase">Venta 90 días por clase ABC</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={abc} barSize={36}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="clase" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} />
              <YAxis
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                cursor={{ fill: "var(--color-bg-warm)" }}
                formatter={(v) => formatColon(Number(v ?? 0))}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="venta" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <List
          title="Mayor rotación"
          rows={top.map((m) => ({
            key: m.product.id,
            title: m.product.name,
            meta: `${m.avgDaily.toFixed(1)} ${m.product.unit}/día · ${formatQty(m.product.stock, m.product.unit)}`,
            extra: <AbcBadge abc={m.abc} />,
          }))}
        />
        <List
          title="Baja o muerta — no inflar"
          rows={slow.map((m) => ({
            key: m.product.id,
            title: m.product.name,
            meta: `${m.daysCover === null ? "sin salida" : `${Math.round(m.daysCover)} d de cobertura`} · ${formatColon(m.stockValue)}`,
            extra: <VelocityBadge velocity={m.velocity} />,
          }))}
        />
      </div>
    </div>
  );
}

function List({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; title: string; meta: string; extra: ReactNode }[];
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl tracking-tight">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted">{r.meta}</p>
            </div>
            {r.extra}
          </li>
        ))}
      </ul>
    </section>
  );
}
