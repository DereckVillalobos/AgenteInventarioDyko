import { Badge } from "@/components/ui/badge";
import { BUY_LABEL, STATUS_LABEL, VELOCITY_LABEL } from "@/lib/inventory/format";
import type { AbcClass, BuyClass, HealthStatus, Velocity } from "@/lib/inventory/types";

const STATUS_TONE: Record<HealthStatus, "neutral" | "ok" | "warn" | "danger" | "info"> = {
  agotado: "danger",
  critico: "danger",
  bajo: "warn",
  saludable: "ok",
  exceso: "info",
  vence: "warn",
  vencido: "danger",
};

const BUY_TONE: Record<BuyClass, "neutral" | "ok" | "warn" | "danger" | "info" | "ink"> = {
  comprar_ya: "danger",
  comprar_pronto: "warn",
  no_comprar: "neutral",
  descontinuar: "info",
  vigilar: "ok",
};

export function StatusBadge({ status }: { status: HealthStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function AbcBadge({ abc }: { abc: AbcClass }) {
  return (
    <Badge tone={abc === "A" ? "ink" : abc === "B" ? "info" : "neutral"}>
      Clase {abc}
    </Badge>
  );
}

export function VelocityBadge({ velocity }: { velocity: Velocity }) {
  return (
    <Badge tone={velocity === "alta" ? "ok" : velocity === "muerta" ? "danger" : "neutral"}>
      {VELOCITY_LABEL[velocity]}
    </Badge>
  );
}

export function BuyBadge({ clasificacion }: { clasificacion: BuyClass }) {
  return <Badge tone={BUY_TONE[clasificacion]}>{BUY_LABEL[clasificacion]}</Badge>;
}
