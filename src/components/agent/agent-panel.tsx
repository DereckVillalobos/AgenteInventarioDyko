import { ArrowUp, Bot } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { askInventoryAgent, type ChatTurn } from "@/lib/agent/ask";
import { SUGGESTIONS, useAgent } from "@/lib/agent/store";
import type { CatalogSnapshot } from "@/lib/inventory/types";
import { useAnalysis } from "@/lib/inventory/store";
import { cn } from "@/lib/utils";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-medium">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export async function sendToAgent(text: string, snapshot: CatalogSnapshot[]) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { busy, push, setBusy, setOpen } = useAgent.getState();
  if (busy) return;
  setOpen(true);
  push({ id: uid(), role: "user", content: trimmed });
  setBusy(true);
  try {
    const history: ChatTurn[] = useAgent
      .getState()
      .messages.filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    const result = await askInventoryAgent({
      data: { messages: history, catalog: snapshot },
    });
    if (result.ok) {
      push({ id: uid(), role: "assistant", content: result.text, traces: result.traces });
    } else {
      push({
        id: uid(),
        role: "assistant",
        content: result.error,
        error: true,
      });
    }
  } catch {
    push({
      id: uid(),
      role: "assistant",
      content: "No pude consultar el inventario. Inténtalo de nuevo.",
      error: true,
    });
  } finally {
    setBusy(false);
  }
}

export function AgentBody() {
  const messages = useAgent((s) => s.messages);
  const busy = useAgent((s) => s.busy);
  const { snapshot } = useAnalysis();
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Soy DARA, el agente de inventario de Dyko. Consulto existencias, vencimientos,
              rotación y te digo qué pedir, qué no pedir y qué promocionar.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm text-fg hover:bg-bg-warm"
                  onClick={() => sendToAgent(s, snapshot)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}
            >
              {m.traces && m.traces.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {m.traces.map((t, i) => (
                    <span
                      key={`${t.name}-${i}`}
                      className="rounded-full bg-bg-warm px-2 py-0.5 text-[10px] tracking-wide text-muted uppercase"
                    >
                      {t.name} · {t.summary}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                className={cn(
                  "max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-accent-fg"
                    : m.error
                      ? "bg-danger-soft text-danger"
                      : "bg-bg-warm text-fg",
                )}
              >
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              </div>
            </div>
          ))
        )}
        {busy ? <p className="text-sm text-muted">Consultando inventario…</p> : null}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = draft;
          setDraft("");
          void sendToAgent(value, snapshot);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Pregúntale a DARA…"
            rows={2}
            className="min-h-11 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const value = draft;
                setDraft("");
                void sendToAgent(value, snapshot);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Enviar">
            <ArrowUp />
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AgentFab() {
  const toggle = useAgent((s) => s.toggle);
  return (
    <Button
      className="fixed right-3 bottom-[4.75rem] z-40 size-12 rounded-full shadow-[var(--shadow-border)] xl:hidden"
      size="icon"
      onClick={toggle}
      aria-label="Abrir agente DARA"
    >
      <Bot className="size-5" />
    </Button>
  );
}
