import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageGate } from "@/components/inventory/page-gate";
import { ProductSheet } from "@/components/inventory/product-sheet";
import { StatusBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { formatColon, formatDate, formatQty } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";
import type { ProductMetrics } from "@/lib/inventory/types";

export const Route = createFileRoute("/vencimientos")({ component: VencimientosPage });

function VencimientosPage() {
  return (
    <AppShell
      title="Vencimientos"
      subtitle="FEFO: primero lo que vence. Lotes vencidos, críticos (≤7 d) y ventana de 14 días."
    >
      <PageGate>
        <ExpiryBoard />
      </PageGate>
    </AppShell>
  );
}

function ExpiryBoard() {
  const { metrics } = useAnalysis();
  const [open, setOpen] = useState<ProductMetrics | null>(null);

  const groups = useMemo(() => {
    const expired = metrics.filter((m) => m.expiredQty > 0);
    const d7 = metrics.filter((m) => m.expiredQty === 0 && m.daysToExpiry !== null && m.daysToExpiry <= 7);
    const d14 = metrics.filter(
      (m) => m.daysToExpiry !== null && m.daysToExpiry > 7 && m.daysToExpiry <= 14,
    );
    return { expired, d7, d14 };
  }, [metrics]);

  const loss7 = [...groups.expired, ...groups.d7].reduce((s, m) => s + m.expiring14Qty * m.product.cost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Vencidos" value={String(groups.expired.length)} />
        <Stat label="≤ 7 días" value={String(groups.d7.length)} />
        <Stat label="En riesgo a costo" value={formatColon(loss7)} />
      </div>
      <Group title="Vencidos — dar de baja o liquidar" rows={groups.expired} onOpen={setOpen} />
      <Group title="Crítico — 7 días o menos" rows={groups.d7} onOpen={setOpen} />
      <Group title="Ventana 8–14 días" rows={groups.d14} onOpen={setOpen} />
      <ProductSheet metric={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function Group({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: ProductMetrics[];
  onOpen: (m: ProductMetrics) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nada en esta banda.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {rows
            .slice()
            .sort((a, b) => (a.daysToExpiry ?? -99) - (b.daysToExpiry ?? -99))
            .map((m) => (
              <li key={m.product.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-bg-warm sm:flex-row sm:items-center sm:gap-4"
                  onClick={() => onOpen(m)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.product.name}</p>
                    <p className="text-xs text-muted">
                      {m.product.sku} · {formatQty(m.product.stock, m.product.unit)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {m.nearestExpiry ? formatDate(m.nearestExpiry) : "—"}
                    <span className="ml-2 text-muted">
                      {m.daysToExpiry === null
                        ? ""
                        : m.daysToExpiry < 0
                          ? `hace ${Math.abs(m.daysToExpiry)} d`
                          : `${m.daysToExpiry} d`}
                    </span>
                  </p>
                  <StatusBadge status={m.status} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
