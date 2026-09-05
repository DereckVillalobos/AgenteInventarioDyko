import { createFileRoute } from "@tanstack/react-router";
import { BuyBadge, StatusBadge } from "@/components/inventory/status-badge";
import { PageGate } from "@/components/inventory/page-gate";
import { AppShell } from "@/components/layout/app-shell";
import { BUY_LABEL, formatColon, formatQty } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";
import type { BuyClass } from "@/lib/inventory/types";

export const Route = createFileRoute("/compras")({ component: ComprasPage });

const ORDER: BuyClass[] = ["comprar_ya", "comprar_pronto", "vigilar", "no_comprar", "descontinuar"];

function ComprasPage() {
  return (
    <AppShell
      title="Plan de compras"
      subtitle="Propuestas para aprobación. InventarioIA no emite órdenes: clasifica comprar_ya, comprar_pronto, no_comprar, descontinuar y vigilar."
    >
      <PageGate>
        <PurchaseBoard />
      </PageGate>
    </AppShell>
  );
}

function PurchaseBoard() {
  const { metrics } = useAnalysis();
  const groups = Object.fromEntries(ORDER.map((k) => [k, metrics.filter((m) => m.orderAction === k)])) as Record<
    BuyClass,
    typeof metrics
  >;
  const pedir = [...groups.comprar_ya, ...groups.comprar_pronto];
  const total = pedir.reduce((s, m) => s + m.orderQty * m.product.cost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Comprar ya" value={String(groups.comprar_ya.length)} />
        <Tile label="Comprar pronto" value={String(groups.comprar_pronto.length)} />
        <Tile label="Costo sugerido" value={formatColon(total)} />
        <Tile label="No / descontinuar" value={String(groups.no_comprar.length + groups.descontinuar.length)} />
      </div>

      {ORDER.map((k) => (
        <section key={k}>
          <h2 className="mb-3 font-display text-2xl tracking-tight">{BUY_LABEL[k]}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
            {groups[k].length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">Nada en esta clase.</li>
            ) : (
              groups[k].map((m) => (
                <li key={m.product.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.product.name}</p>
                    <p className="text-xs text-muted">{m.orderReason}</p>
                  </div>
                  {m.orderQty > 0 ? (
                    <p className="text-sm tabular-nums">
                      {formatQty(m.orderQty, m.product.unit)}
                      <span className="ml-2 text-muted">{formatColon(m.orderQty * m.product.cost)}</span>
                    </p>
                  ) : null}
                  <BuyBadge clasificacion={m.orderAction} />
                  <StatusBadge status={m.status} />
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
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
