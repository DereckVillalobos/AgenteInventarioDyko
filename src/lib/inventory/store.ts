import { create } from "zustand";
import { analyzeCatalog, briefing, buildAlerts, buildReport, kpis, toSnapshot } from "./analytics";
import { buildCatalog } from "./seed";
import type { AgentMode, CatalogSnapshot, InventoryReport, Product } from "./types";
import { DEFAULT_PARAMS } from "./types";


type InventoryState = {
  ready: boolean;
  products: Product[];
  mode: AgentMode;
  init: () => void;
  reset: () => void;
  setMode: (mode: AgentMode) => void;
  adjustStock: (id: string, delta: number) => void;
  setStock: (id: string, qty: number) => void;
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
  mode: "cuidadoso",
  init: () => {
    if (get().ready) return;
    set({ ready: true, products: buildCatalog() });
  },
  reset: () => set({ ready: true, products: buildCatalog() }),
  setMode: (mode) => set({ mode }),
  adjustStock: (id, delta) =>
    set({
      products: get().products.map((p) => (p.id === id ? withStock(p, p.stock + delta) : p)),
    }),
  setStock: (id, qty) =>
    set({
      products: get().products.map((p) => (p.id === id ? withStock(p, qty) : p)),
    }),
}));

export function useAnalysis() {
  const products = useInventory((s) => s.products);
  const ready = useInventory((s) => s.ready);
  const mode = useInventory((s) => s.mode);
  const metrics = ready ? analyzeCatalog(products) : [];
  const report: InventoryReport | null = ready ? buildReport(metrics, mode) : null;
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
  };
}
