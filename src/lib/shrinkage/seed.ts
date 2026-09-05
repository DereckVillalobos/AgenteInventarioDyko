import { todayLocalIso } from "@/lib/inventory/format";
import type { PhysicalCount } from "./types";

const COUNTER = "Karina M. · turno mañana";

/** Demo: ciclo de conteo parcial. Lo no listado es dato faltante, no se inventa. */
export function buildPhysicalCounts(today = todayLocalIso()): PhysicalCount[] {
  const countedAt = today;
  const row = (sku: string, countedQty: number): PhysicalCount => ({
    sku,
    countedQty,
    countedAt,
    countedBy: COUNTER,
  });
  return [
    row("DYK-LAC-001", 13),
    row("DYK-LAC-002", 34),
    row("DYK-LAC-003", 8),
    row("DYK-LAC-004", 26),
    row("DYK-LAC-005", 14),
    row("DYK-ABA-001", 72),
    row("DYK-ABA-003", 40),
    row("DYK-ABA-005", 11),
    row("DYK-CUI-001", 33),
    row("DYK-CUI-002", 40),
    row("DYK-CUI-003", 3),
    row("DYK-SNK-001", 49),
    row("DYK-SNK-002", 61),
    row("DYK-CAR-001", 8),
    row("DYK-CAR-002", 4),
  ];
}
