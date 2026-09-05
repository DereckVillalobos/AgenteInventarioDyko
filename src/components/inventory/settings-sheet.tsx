import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useInventory } from "@/lib/inventory/store";
import { CATEGORIES, CATEGORY_LABEL, DEFAULT_PARAMS, DEFAULT_TENANT } from "@/lib/inventory/types";

export function SettingsSheet() {
  const params = useInventory((s) => s.params);
  const tenant = useInventory((s) => s.tenant);
  const setParams = useInventory((s) => s.setParams);
  const setSafety = useInventory((s) => s.setSafety);
  const setTenant = useInventory((s) => s.setTenant);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Configuración del negocio">
          <Settings />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Negocio</SheetTitle>
          <SheetDescription>
            Sucursal, margen y ventanas. InventarioIA y MermaIA leen esto; no se inventan cifras.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-5 py-5">
          <section className="flex flex-col gap-3">
            <p className="text-xs tracking-wide text-muted uppercase">Identidad</p>
            <Field label="Empresa">
              <Input value={tenant.company} onChange={(e) => setTenant({ company: e.target.value })} />
            </Field>
            <Field label="Sucursal">
              <Input value={tenant.branch} onChange={(e) => setTenant({ branch: e.target.value })} />
            </Field>
          </section>
          <section className="flex flex-col gap-3">
            <p className="text-xs tracking-wide text-muted uppercase">Reglas de inventario</p>
            <Field label="Margen mínimo (%)">
              <Input
                type="number"
                min={0}
                max={90}
                value={Math.round(params.margenMinimo * 100)}
                onChange={(e) => setParams({ margenMinimo: Math.min(0.9, Math.max(0, Number(e.target.value) / 100)) })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Crítico (d)">
                <Input
                  type="number"
                  min={1}
                  value={params.vencimientoCriticoDias}
                  onChange={(e) => setParams({ vencimientoCriticoDias: Math.max(1, Number(e.target.value)) })}
                />
              </Field>
              <Field label="Alerta (d)">
                <Input
                  type="number"
                  min={1}
                  value={params.vencimientoAlertaDias}
                  onChange={(e) => setParams({ vencimientoAlertaDias: Math.max(1, Number(e.target.value)) })}
                />
              </Field>
              <Field label="Vigilar (d)">
                <Input
                  type="number"
                  min={1}
                  value={params.vencimientoVigilarDias}
                  onChange={(e) => setParams({ vencimientoVigilarDias: Math.max(1, Number(e.target.value)) })}
                />
              </Field>
            </div>
            <Field label="Sobre-stock (días de cobertura)">
              <Input
                type="number"
                min={14}
                value={params.sobreStockDias}
                onChange={(e) => setParams({ sobreStockDias: Math.max(14, Number(e.target.value)) })}
              />
            </Field>
          </section>
          <section className="flex flex-col gap-3">
            <p className="text-xs tracking-wide text-muted uppercase">Stock de seguridad (días)</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <Field key={c} label={CATEGORY_LABEL[c]}>
                  <Input
                    type="number"
                    min={0}
                    value={params.stockSeguridadDias[c]}
                    onChange={(e) => setSafety(c, Number(e.target.value))}
                  />
                </Field>
              ))}
            </div>
          </section>
          <Button
            variant="outline"
            onClick={() => {
              setParams({
                ...DEFAULT_PARAMS,
                stockSeguridadDias: { ...DEFAULT_PARAMS.stockSeguridadDias },
              });
              setTenant({ ...DEFAULT_TENANT });
            }}
          >
            Restaurar valores Dyko
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
