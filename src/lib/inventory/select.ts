import { diffDays, todayLocalIso } from "./format";
import type { CatalogCoverage, CatalogSnapshot } from "./types";
import { AGENT_CATALOG_CAP } from "./types";

export function snapshotUrgency(s: CatalogSnapshot, today = todayLocalIso()): number {
  let n = 0;
  if (s.stock <= 0) n += 100;
  else if (s.stock <= s.minStock) n += 80;
  const cover = s.avgDaily > 0.05 ? s.stock / s.avgDaily : s.stock > 0 ? 999 : 0;
  if (cover < s.leadDays) n += 90;
  if (s.perishable) {
    const nearest = s.lots.map((l) => diffDays(today, l.expiry)).sort((a, b) => a - b)[0];
    if (nearest !== undefined && nearest <= 7) n += 85;
    else if (nearest !== undefined && nearest <= 30) n += 40;
    if (s.lots.length === 0) n += 20;
  }
  if (s.sales30 === 0 && s.stock > s.minStock) n += 25;
  return n;
}

/** Prefer quiebre/vencimiento over “first 80 in arrival order”. Declare what we drop. */
export function selectCatalogForAgent(
  snaps: CatalogSnapshot[],
  cap = AGENT_CATALOG_CAP,
  today = todayLocalIso(),
): CatalogCoverage & { selected: CatalogSnapshot[] } {
  const total = snaps.length;
  if (total <= cap) {
    return { selected: snaps, total, analyzed: total, omitted: 0, note: null };
  }
  const ranked = snaps
    .map((s, i) => ({ s, i, u: snapshotUrgency(s, today) }))
    .sort((a, b) => b.u - a.u || a.i - b.i);
  const selected = ranked.slice(0, cap).map((r) => r.s);
  const omitted = total - cap;
  return {
    selected,
    total,
    analyzed: selected.length,
    omitted,
    note: `Se analizaron ${cap} de ${total} SKU (prioridad: quiebre, vencimiento, sobre-stock). ${omitted} no se evaluaron. No se asume nada del resto.`,
  };
}
