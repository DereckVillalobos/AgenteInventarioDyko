import { create } from "zustand";
import { analyzeCatalog, briefing, buildAlerts, buildReport, kpis, toSnapshot } from "./analytics";
import { buildCatalog } from "./seed";
import type { AgentMode, CatalogSnapshot, InventoryReport, Product } from "./types";
import { DEFAULT_PARAMS } from "./types";
import { analyzeShrinkage, buildShrinkageReport, shrinkageKpis } from "@/lib/shrinkage/analytics";
import { buildPhysicalCounts } from "@/lib/shrinkage/seed";
import type { PhysicalCount, ShrinkageReport } from "@/lib/shrinkage/types";


type InventoryState = {
  ready: boolean;
  products: Product[];
  counts: PhysicalCount[];
  mode: AgentMode;
  init: () => void;
  reset: () => void;
  setMode: (mode: AgentMode) => void;
  adjustStock: (id: string, delta: number) => void;
  setStock: (id: string, qty: number) => void;
  setCount: (sku: string, qty: number) => void;
};

function withStock(p: Product, next: number): Product {
  const stock = Math.max(0, Math.round(next));
  const lots = p.lots.map((l) => ({ ...l })).sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (lots.length === 0) {
    return { ...p, stock };
  }
  const total = lots.reduce((s, l) => s + l.qty, 0);
  if (stock === total) return { ...p, stock, lots };
  if (stock > total) {
    const extra = stock - total;
    const last = lots[lots.length - 1];
    if (last) last.qty += extra;
    return { ...p, stock, lots };
  }
  let remain = total - stock;
  const nextLots = lots
    .map((lot) => {
      if (remain <= 0) return lot;
      const take = Math.min(lot.qty, remain);
      remain -= take;
      return { ...lot, qty: lot.qty - take };
    })
    .filter((l) => l.qty > 0);
  return { ...p, stock, lots: nextLots };
}

export const useInventory = create<InventoryState>((set, get) => ({
  ready: false,
  products: [],
  counts: [],
  mode: "cuidadoso",
  init: () => {
    if (get().ready) return;
    set({ ready: true, products: buildCatalog(), counts: buildPhysicalCounts() });
  },
  reset: () => set({ ready: true, products: buildCatalog(), counts: buildPhysicalCounts() }),
  setMode: (mode) => set({ mode }),
  adjustStock: (id, delta) =>
    set({
      products: get().products.map((p) => (p.id === id ? withStock(p, p.stock + delta) : p)),
    }),
  setStock: (id, qty) =>
    set({
      products: get().products.map((p) => (p.id === id ? withStock(p, qty) : p)),
    }),
  setCount: (sku, qty) => {
    const n = Math.max(0, Math.round(qty));
    const counts = get().counts;
    const i = counts.findIndex((c) => c.sku === sku);
    if (i >= 0) {
      const next = counts.map((c) => (c.sku === sku ? { ...c, countedQty: n } : c));
      set({ counts: next });
      return;
    }
    set({
      counts: [
        ...counts,
        { sku, countedQty: n, countedAt: new Date().toISOString().slice(0, 10), countedBy: "Ajuste en pantalla" },
      ],
    });
  },
}));

export function useAnalysis() {
  const products = useInventory((s) => s.products);
  const ready = useInventory((s) => s.ready);
  const mode = useInventory((s) => s.mode);
  const counts = useInventory((s) => s.counts);
  const metrics = ready ? analyzeCatalog(products) : [];
  const shrinkRows = ready ? analyzeShrinkage(metrics, counts) : [];
  const report: InventoryReport | null = ready ? buildReport(metrics, mode) : null;
  const shrinkReport: ShrinkageReport | null = ready ? buildShrinkageReport(shrinkRows) : null;
  return {
    ready,
    products,
    metrics,
    mode,
    params: DEFAULT_PARAMS,
    alerts: ready ? buildAlerts(metrics) : [],
    kpis: ready ? kpis(metrics) : null,
    briefing: ready ? briefing(metrics) : [],
    snapshot: ready ? products.map(toSnapshot) : ([] as CatalogSnapshot[]),
    report,
    counts,
    shrinkRows,
    shrinkReport,
    shrinkKpis: ready ? shrinkageKpis(shrinkRows) : null,
  };
}
