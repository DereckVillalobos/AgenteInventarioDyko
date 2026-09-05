import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageGate } from "@/components/inventory/page-gate";
import { ShrinkBadge } from "@/components/inventory/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgent } from "@/lib/agent/store";
import { formatColon, formatQty } from "@/lib/inventory/format";
import { useAnalysis, useInventory } from "@/lib/inventory/store";
import {
  SHRINK_ACTION_LABEL,
  type ShrinkClass,
  type ShrinkageRow,
} from "@/lib/shrinkage/types";

export const Route = createFileRoute("/merma")({ component: MermaPage });

const ORDER: ShrinkClass[] = [
  "posible_hurto",
  "merma_operativa",
  "merma_no_clasificada",
  "sobrante",
  "error_probable_conteo",
  "sin_conteo",
  "cuadrado",
];

function MermaPage() {
  const setDomain = useAgent((s) => s.setDomain);
  useEffect(() => {
    setDomain("merma");
  }, [setDomain]);

  return (
    <AppShell
      title="Merma vs conteo"
      subtitle="MermaIA compara stock teórico con el conteo físico. No ajusta existencias: tú apruebas cada baja o corrección."
    >
      <PageGate>
        <MermaBoard />
      </PageGate>
    </AppShell>
  );
}

function MermaBoard() {
  const { shrinkRows, shrinkKpis, shrinkReport, products } = useAnalysis();
  const setCount = useInventory((s) => s.setCount);
  const setStock = useInventory((s) => s.setStock);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(
    () => Object.fromEntries(ORDER.map((k) => [k, shrinkRows.filter((r) => r.clasificacion === k)])) as Record<
      ShrinkClass,
      ShrinkageRow[]
    >,
    [shrinkRows],
  );

  if (!shrinkKpis || !shrinkReport) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Cobertura de conteo" value={`${shrinkKpis.coveragePct}%`} hint={`${shrinkKpis.counted}/${shrinkKpis.skuCount} SKU`} />
        <Tile label="Merma a costo" value={formatColon(shrinkKpis.valorMerma)} hint={`${shrinkKpis.discrepancias} discrepancias`} />
        <Tile label="Sobrante" value={formatColon(shrinkKpis.valorSobrante)} />
        <Tile label="Posible hurto" value={String(shrinkKpis.hurto)} hint={`${shrinkKpis.sinConteo} sin conteo`} />
      </div>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs tracking-wide text-muted uppercase">
            Reporte MermaIA · {shrinkReport.fecha_conteo ?? shrinkReport.fecha_analisis}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(JSON.stringify(shrinkReport, null, 2));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "JSON copiado" : "Copiar JSON Dyko"}
          </Button>
        </div>
        <p className="text-sm leading-relaxed">{shrinkReport.resumen_ejecutivo}</p>
      </section>

      {ORDER.map((k) => {
        if (groups[k].length === 0 && k !== "posible_hurto") return null;
        return (
          <section key={k}>
            <h2 className="mb-3 font-display text-2xl tracking-tight">{labelTitle(k)}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {groups[k].length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">Nada en esta clase. Hipótesis, no sentencia.</li>
              ) : (
                groups[k].map((r) => {
                  const p = products.find((x) => x.sku === r.sku);
                  return (
                    <li key={r.sku} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.producto}</p>
                        <p className="text-xs text-muted">{r.justificacion}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs tabular-nums text-muted">
                          Teórico {formatQty(r.stockTeorico, r.unit)}
                        </span>
                        <label className="flex items-center gap-1 text-xs text-muted">
                          Físico
                          <Input
                            className="h-11 w-16 tabular-nums"
                            type="number"
                            min={0}
                            defaultValue={r.stockFisico ?? ""}
                            key={`${r.sku}-${r.stockFisico}`}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v === "") return;
                              setCount(r.sku, Number(v));
                            }}
                            aria-label={`Conteo físico de ${r.producto}`}
                          />
                        </label>
                        {r.diferencia !== null && r.diferencia !== 0 ? (
                          <span className="text-sm tabular-nums">
                            {r.diferencia > 0 ? "+" : ""}
                            {r.diferencia} · {formatColon(r.valorCrc)}
                          </span>
                        ) : null}
                        <ShrinkBadge clasificacion={r.clasificacion} />
                        {r.accion_sugerida === "dar_de_baja" || r.accion_sugerida === "ajustar_teorico" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={r.stockFisico === null || !p}
                            onClick={() => {
                              if (!p || r.stockFisico === null) return;
                              setStock(p.id, r.stockFisico);
                            }}
                          >
                            {SHRINK_ACTION_LABEL[r.accion_sugerida]}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">{SHRINK_ACTION_LABEL[r.accion_sugerida]}</span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function labelTitle(k: ShrinkClass) {
  const map: Record<ShrinkClass, string> = {
    posible_hurto: "Posible hurto — investigar",
    merma_operativa: "Merma operativa — baja con aprobación",
    merma_no_clasificada: "Sin clasificar",
    sobrante: "Sobrante",
    error_probable_conteo: "Error de conteo probable",
    sin_conteo: "Sin conteo — dato faltante",
    cuadrado: "Cuadrados",
  };
  return map[k];
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}
