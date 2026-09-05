import { create } from "zustand";
import type { ChatTurn, ToolTrace } from "./ask";

export type AgentMessage = ChatTurn & {
  id: string;
  traces?: ToolTrace[];
  error?: boolean;
};

type AgentState = {
  open: boolean;
  busy: boolean;
  messages: AgentMessage[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  push: (msg: AgentMessage) => void;
  setBusy: (busy: boolean) => void;
};

export const SUGGESTIONS = [
  "Reporte de salud de inventario (JSON + resumen)",
  "¿Qué está en quiebre inminente?",
  "Vencimientos críticos (≤7 días) y alerta (≤30)",
  "Qué comprar ya, qué no comprar y qué descontinuar",
  "Promociones que respeten el margen mínimo 25%",
];

export const useAgent = create<AgentState>((set) => ({
  open: false,
  busy: false,
  messages: [],
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  push: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setBusy: (busy) => set({ busy }),
}));
