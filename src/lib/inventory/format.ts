import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { AbcClass, HealthStatus, Velocity } from "./types";

export function todayLocalIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayLocalIso(dt);
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T12:00:00");
  const b = new Date(toIso + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatColon(n: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatQty(n: number, unit?: string): string {
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return unit ? `${rounded} ${unit}` : rounded;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: es });
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMM", { locale: es });
}

export const STATUS_LABEL: Record<HealthStatus, string> = {
  agotado: "Agotado",
  critico: "Crítico",
  bajo: "Bajo",
  saludable: "Saludable",
  exceso: "Exceso",
  vence: "Por vencer",
  vencido: "Vencido",
};

export const VELOCITY_LABEL: Record<Velocity, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  muerta: "Muerta",
};

export const ABC_LABEL: Record<AbcClass, string> = {
  A: "A · alta rotación",
  B: "B · media",
  C: "C · lenta",
};
