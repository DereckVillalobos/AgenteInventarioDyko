import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatColon, formatDate, formatQty, TREND_LABEL } from "@/lib/inventory/format";
import { useInventory } from "@/lib/inventory/store";
import type { ProductMetrics } from "@/lib/inventory/types";
import { CATEGORY_LABEL } from "@/lib/inventory/types";
import { AbcBadge, BuyBadge, StatusBadge, VelocityBadge } from "./status-badge";
import { Sparkline } from "./sparkline";

export function ProductSheet({
  metric,
  onClose,
}: {
  metric: ProductMetrics | null;
  onClose: () => void;
}) {
  const adjustStock = useInventory((s) => s.adjustStock);
  if (!metric) return null;
  const p = metric.product;
  return (
    <Sheet open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{p.name}</SheetTitle>
          <SheetDescription>
            {p.brand} · {p.sku} · {CATEGORY_LABEL[p.category]}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={metric.status} />
            <AbcBadge abc={metric.abc} />
            <VelocityBadge velocity={metric.velocity} />
            <BuyBadge clasificacion={metric.orderAction} />
          </div>

          <div className="rounded-lg bg-bg-warm p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Existencia</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-display text-4xl tracking-tight tabular-nums">
                {p.stock}
                <span className="ml-2 text-lg text-muted">{p.unit}</span>
              </p>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-11"
                  onClick={() => adjustStock(p.id, -1)}
                  aria-label="Quitar una unidad"
                >
                  <Minus />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-11"
                  onClick={() => adjustStock(p.id, 1)}
                  aria-label="Agregar una unidad"
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              Objetivo {formatQty(metric.targetStock, p.unit)} · mín {p.minStock} · máx {p.maxStock}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Costo / precio</dt>
              <dd className="tabular-nums">
                {formatColon(p.cost)} · {formatColon(p.price)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Valor en bodega</dt>
              <dd className="tabular-nums">{formatColon(metric.stockValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Salida 7 / 30 / 90 d</dt>
              <dd className="tabular-nums">
                {metric.sales7} · {metric.sales30} · {metric.sales90}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Promedio diario</dt>
              <dd className="tabular-nums">{metric.avgDaily.toFixed(1)} {p.unit}/día</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cobertura</dt>
              <dd className="tabular-nums">
                {metric.daysCover === null ? "Sin rotación" : `${Math.round(metric.daysCover)} días`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Lead time</dt>
              <dd>{p.leadDays} días</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tendencia</dt>
              <dd>{TREND_LABEL[metric.tendencia]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Margen actual</dt>
              <dd className="tabular-nums">{Math.round(metric.marginPct * 100)}%</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Rotación 90 días</p>
            <Sparkline values={p.dailySales.slice(-42)} className="h-10 w-full max-w-xs text-accent" />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Lotes (FEFO)</p>
            {p.lots.length === 0 ? (
              <p className="text-sm text-muted">Sin lotes registrados.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {p.lots.map((lot) => (
                  <li key={lot.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="tabular-nums">{formatQty(lot.qty, p.unit)}</span>
                    <span className="text-muted">vence {formatDate(lot.expiry)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Pedido (propuesta)</p>
            <p className="mt-1 text-sm">{metric.orderReason}</p>
            {metric.orderQty > 0 ? (
              <Badge tone="ink" className="mt-2">
                Sugerir {formatQty(metric.orderQty, p.unit)} · {formatColon(metric.orderQty * p.cost)}
              </Badge>
            ) : (
              <Badge className="mt-2">No comprar</Badge>
            )}
          </div>

          {metric.promo ? (
            <div className="rounded-lg bg-warn-soft p-4 text-warn">
              <p className="text-xs font-medium tracking-wide uppercase">
                Promoción · {metric.promo.tipo}
                {metric.promo.perdida_controlada ? " · pérdida controlada" : ""}
              </p>
              <p className="mt-1 font-display text-2xl tracking-tight">−{metric.promo.discount}%</p>
              <p className="mt-1 text-sm">{metric.promo.justificacion}</p>
              {metric.promo.bundleName ? (
                <p className="mt-1 text-xs">Bundle: {metric.promo.bundleName}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
