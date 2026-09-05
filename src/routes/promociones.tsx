import { createFileRoute } from "@tanstack/react-router";
import { PageGate } from "@/components/inventory/page-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatColon, formatQty } from "@/lib/inventory/format";
import { useAnalysis } from "@/lib/inventory/store";

export const Route = createFileRoute("/promociones")({ component: PromosPage });

function PromosPage() {
  return (
    <AppShell
      title="Promociones"
      subtitle="Descuentos sugeridos por lote que vence o por rotación que no se mueve."
    >
      <PageGate>
        <PromoBoard />
      </PageGate>
    </AppShell>
  );
}

function PromoBoard() {
  const { metrics } = useAnalysis();
  const rows = metrics
    .filter((m) => m.promo)
    .sort((a, b) => {
      const rank = { alta: 0, media: 1, baja: 2 } as const;
      return rank[a.promo!.urgency] - rank[b.promo!.urgency];
    });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((m) => {
        const promo = m.promo!;
        const next = Math.round(m.product.price * (1 - promo.discount / 100));
        return (
          <article key={m.product.id} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl tracking-tight">{m.product.name}</h2>
                <p className="text-xs text-muted">
                  {m.product.sku} · {formatQty(m.product.stock, m.product.unit)}
                </p>
              </div>
              <Badge tone={promo.urgency === "alta" ? "danger" : promo.urgency === "media" ? "warn" : "neutral"}>
                {promo.urgency}
              </Badge>
            </div>
            <p className="mt-4 font-display text-4xl tracking-tight">−{promo.discount}%</p>
            <p className="mt-1 text-sm tabular-nums text-muted">
              {formatColon(m.product.price)} → {formatColon(next)}
            </p>
            <p className="mt-3 text-sm">{promo.reason}</p>
          </article>
        );
      })}
    </div>
  );
}
