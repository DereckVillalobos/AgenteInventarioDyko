import { createFileRoute } from "@tanstack/react-router";
import { PageGate } from "@/components/inventory/page-gate";
import { StatusBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { formatColon, formatQty } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";

export const Route = createFileRoute("/compras")({ component: ComprasPage });

function ComprasPage() {
  return (
    <AppShell
      title="Plan de compras"
      subtitle="Qué pedir según rotación y cobertura, y qué no pedir por exceso, vencimiento o rotación muerta."
    >
      <PageGate>
        <PurchaseBoard />
      </PageGate>
    </AppShell>
  );
}

function PurchaseBoard() {
  const { metrics } = useAnalysis();
  const pedir = metrics
    .filter((m) => m.orderAction !== "no_pedir")
    .sort((a, b) => {
      if (a.orderAction !== b.orderAction) return a.orderAction === "urgente" ? -1 : 1;
      return b.orderQty * b.product.cost - a.orderQty * a.product.cost;
    });
  const noPedir = metrics
    .filter((m) => m.orderAction === "no_pedir" && (m.status === "exceso" || m.velocity === "muerta" || m.velocity === "baja"))
    .sort((a, b) => b.stockValue - a.stockValue);
  const total = pedir.reduce((s, m) => s + m.orderQty * m.product.cost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Líneas a pedir" value={String(pedir.length)} />
        <Tile label="Costo del pedido" value={formatColon(total)} />
        <Tile label="No reponer" value={String(noPedir.length)} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-2xl tracking-tight">Pedir</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {pedir.map((m) => (
            <li key={m.product.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.product.name}</p>
                <p className="text-xs text-muted">{m.orderReason}</p>
              </div>
              <p className="text-sm tabular-nums">
                {formatQty(m.orderQty, m.product.unit)}
                <span className="ml-2 text-muted">{formatColon(m.orderQty * m.product.cost)}</span>
              </p>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl tracking-tight">No pedir</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {noPedir.map((m) => (
            <li key={m.product.id} className="px-4 py-3">
              <p className="text-sm font-medium">{m.product.name}</p>
              <p className="text-xs text-muted">{m.orderReason}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
