import { create } from "zustand";
import { analyzeCatalog, briefing, buildAlerts, buildReport, kpis, toSnapshot } from "./analytics";
import { buildCatalog } from "./seed";
import type {
  AgentMode,
  BusinessParams,
  CatalogSnapshot,
  InventoryReport,
  Product,
  Tenant,
} from "./types";
import { DEFAULT_PARAMS, DEFAULT_TENANT } from "./types";
import { analyzeShrinkage, buildShrinkageReport, shrinkageKpis } from "@/lib/shrinkage/analytics";
import { buildPhysicalCounts } from "@/lib/shrinkage/seed";
import type { PhysicalCount, ShrinkageReport } from "@/lib/shrinkage/types";

const CONFIG_KEY = "dyko-intelligence-config";

function loadConfig(): { params?: BusinessParams; tenant?: Tenant } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { params?: BusinessParams; tenant?: Tenant };
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveConfig(params: BusinessParams, tenant: Tenant) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ params, tenant }));
  } catch {
    /* ignore quota */
  }
}

type InventoryState = {
  ready: boolean;
  products: Product[];
  counts: PhysicalCount[];
  mode: AgentMode;
  params: BusinessParams;
  tenant: Tenant;
  init: () => void;
  reset: () => void;
  setMode: (mode: AgentMode) => void;
  setParams: (patch: Partial<BusinessParams>) => void;
  setSafety: (category: Product["category"], days: number) => void;
  setTenant: (patch: Partial<Tenant>) => void;
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
  params: DEFAULT_PARAMS,
  tenant: DEFAULT_TENANT,
  init: () => {
    if (get().ready) return;
    const saved = loadConfig();
    set({
      ready: true,
      products: buildCatalog(),
      counts: buildPhysicalCounts(),
      params: saved.params ? { ...DEFAULT_PARAMS, ...saved.params, stockSeguridadDias: { ...DEFAULT_PARAMS.stockSeguridadDias, ...saved.params.stockSeguridadDias } } : DEFAULT_PARAMS,
      tenant: saved.tenant ? { ...DEFAULT_TENANT, ...saved.tenant } : DEFAULT_TENANT,
    });
  },
  reset: () =>
    set({
      ready: true,
      products: buildCatalog(),
      counts: buildPhysicalCounts(),
    }),
  setMode: (mode) => set({ mode }),
  setParams: (patch) => {
    const params = { ...get().params, ...patch };
    set({ params });
    saveConfig(params, get().tenant);
  },
  setSafety: (category, days) => {
    const params = {
      ...get().params,
      stockSeguridadDias: { ...get().params.stockSeguridadDias, [category]: Math.max(0, Math.round(days)) },
    };
    set({ params });
    saveConfig(params, get().tenant);
  },
  setTenant: (patch) => {
    const tenant = { ...get().tenant, ...patch };
    set({ tenant });
    saveConfig(get().params, tenant);
  },
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
  const params = useInventory((s) => s.params);
  const tenant = useInventory((s) => s.tenant);
  const metrics = ready ? analyzeCatalog(products, undefined, params) : [];
  const shrinkRows = ready ? analyzeShrinkage(metrics, counts) : [];
  const report: InventoryReport | null = ready ? buildReport(metrics, mode) : null;
  const shrinkReport: ShrinkageReport | null = ready ? buildShrinkageReport(shrinkRows) : null;
  return {
    ready,
    products,
    metrics,
    mode,
    params,
    tenant,
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
