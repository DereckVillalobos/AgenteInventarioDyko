import { create } from "zustand";
import type { AgentDomain, ChatTurn, ToolTrace } from "./ask";

export type AgentMessage = ChatTurn & {
  id: string;
  traces?: ToolTrace[];
  error?: boolean;
};

export type { AgentDomain };

type AgentState = {
  open: boolean;
  busy: boolean;
  domain: AgentDomain;
  messages: AgentMessage[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setDomain: (domain: AgentDomain) => void;
  push: (msg: AgentMessage) => void;
  setBusy: (busy: boolean) => void;
};

export const SUGGESTIONS: Record<AgentDomain, string[]> = {
  inventario: [
    "Reporte de salud de inventario (JSON + resumen)",
    "¿Qué está en quiebre inminente?",
    "Vencimientos críticos (≤7 días) y alerta (≤30)",
    "Qué comprar ya, qué no comprar y qué descontinuar",
    "Promociones que respeten el margen mínimo 25%",
  ],
  merma: [
    "Reporte de merma vs conteo físico (JSON)",
    "¿Dónde hay posible hurto?",
    "Merma operativa por vencimiento",
    "Qué SKU faltan por contar",
    "No ajustes: ¿qué debo aprobar hoy?",
  ],
};

export const useAgent = create<AgentState>((set) => ({
  open: false,
  busy: false,
  domain: "inventario",
  messages: [],
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  setDomain: (domain) => set((s) => (s.domain === domain ? s : { domain, messages: [] })),
  push: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setBusy: (busy) => set({ busy }),
}));
