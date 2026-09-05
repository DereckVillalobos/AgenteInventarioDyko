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
  "¿Qué está en riesgo de quiebre de stock?",
  "¿Qué vence en los próximos 14 días?",
  "¿Qué debo pedir esta semana y qué no?",
  "¿A cuáles productos conviene promoción?",
  "Dame el stock saludable por categoría",
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
