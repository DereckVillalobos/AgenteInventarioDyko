import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageGate } from "@/components/inventory/page-gate";
import { ProductSheet } from "@/components/inventory/product-sheet";
import { Sparkline } from "@/components/inventory/sparkline";
import { AbcBadge, StatusBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { formatColon, formatQty, STATUS_LABEL } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";
import { CATEGORIES, CATEGORY_LABEL, type HealthStatus } from "@/lib/inventory/types";
import type { ProductMetrics } from "@/lib/inventory/types";

export const Route = createFileRoute("/inventario")({ component: InventarioPage });

const STATUSES: HealthStatus[] = [
  "agotado",
  "critico",
  "bajo",
  "vence",
  "vencido",
  "exceso",
  "saludable",
];

function InventarioPage() {
  return (
    <AppShell
      title="Inventario"
      subtitle="Existencias, banda saludable y clase ABC. Toca un producto para lotes y ajuste."
    >
      <PageGate>
        <InventoryTable />
      </PageGate>
    </AppShell>
  );
}

function InventoryTable() {
  const { metrics } = useAnalysis();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [st, setSt] = useState<string>("all");
  const [open, setOpen] = useState<ProductMetrics | null>(null);

  const rows = useMemo(() => {
    return metrics.filter((m) => {
      const p = m.product;
      if (cat !== "all" && p.category !== cat) return false;
      if (st !== "all" && m.status !== st) return false;
      if (q && !`${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [metrics, q, cat, st]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar SKU, producto o marca"
            className="pl-10"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          value={st}
          onChange={(e) => setSt(e.target.value)}
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted tabular-nums">{rows.length} productos</p>

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Cobertura</th>
              <th className="px-4 py-3 font-medium">ABC</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">90 d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => {
              const p = m.product;
              return (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-bg-warm"
                  onClick={() => setOpen(m)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.sku} · {p.brand}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatQty(p.stock, p.unit)}
                    <p className="text-xs text-muted">obj. {m.targetStock}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {m.daysCover === null ? "—" : `${Math.round(m.daysCover)} d`}
                  </td>
                  <td className="px-4 py-3">
                    <AbcBadge abc={m.abc} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatColon(m.stockValue)}</td>
                  <td className="px-4 py-3">
                    <Sparkline values={p.dailySales.slice(-28)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ProductSheet metric={open} onClose={() => setOpen(null)} />
    </div>
  );
}
