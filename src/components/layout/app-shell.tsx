import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Package,
  Percent,
  X,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { AgentBody, AgentFab } from "@/components/agent/agent-panel";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAgent } from "@/lib/agent/store";
import { BRANCH, COMPANY } from "@/lib/inventory/types";
import { useInventory } from "@/lib/inventory/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/inventario", label: "Inventario", icon: Package },
  { to: "/vencimientos", label: "Vence", icon: CalendarClock },
  { to: "/rotacion", label: "Rotación", icon: ArrowUpDown },
  { to: "/compras", label: "Compras", icon: ClipboardList },
  { to: "/promociones", label: "Promos", icon: Percent },
] as const;

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="3" className="fill-accent" />
      <path
        d="M8 7h5.2c3 0 4.8 1.6 4.8 5s-1.8 5-4.8 5H8V7zm3 2.4v5.2h2c1.5 0 2.3-.8 2.3-2.6s-.8-2.6-2.3-2.6H11z"
        className="fill-accent-fg"
      />
    </svg>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const init = useInventory((s) => s.init);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const open = useAgent((s) => s.open);
  const setOpen = useAgent((s) => s.setOpen);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-bg text-fg">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur-sm">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-xl tracking-tight">{COMPANY}</span>
            <span className="hidden text-sm text-muted sm:inline">Inventario</span>
          </Link>
          <span className="ml-auto truncate text-xs text-muted">{BRANCH}</span>
        </header>

        <div className="flex">
          <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[220px] shrink-0 flex-col gap-1 border-r border-border p-3 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md px-3 text-sm",
                    active ? "bg-accent text-accent-fg" : "text-muted hover:bg-bg-warm hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label === "Vence" ? "Vencimientos" : item.label === "Promos" ? "Promociones" : item.label}
                </Link>
              );
            })}
            <Button
              variant="ghost"
              className="mt-auto justify-start text-muted"
              onClick={() => useInventory.getState().reset()}
            >
              Restaurar demo
            </Button>
          </nav>

          <div className="flex min-w-0 flex-1">
            <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-6 md:pb-10">
              <div className="mb-5">
                <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
                {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
              </div>
              {children}
            </main>

            {open ? (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-ink/40 xl:hidden"
                aria-label="Cerrar agente"
                onClick={() => setOpen(false)}
              />
            ) : null}

            <aside
              className={cn(
                "flex-col bg-surface",
                "max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-50 max-xl:h-[85vh] max-xl:rounded-t-xl max-xl:border-t max-xl:border-border",
                "xl:flex xl:h-[calc(100vh-3.5rem)] xl:w-[360px] xl:shrink-0 xl:border-l xl:border-border",
                open ? "flex" : "hidden xl:flex",
              )}
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">InventarioIA</p>
                  <p className="text-xs text-muted">Recomienda · tú apruebas</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 xl:hidden"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar agente"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <AgentBody />
            </aside>
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <AgentFab />
      </div>
    </TooltipProvider>
  );
}
