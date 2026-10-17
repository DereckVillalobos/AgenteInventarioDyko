# DEMO de InventarioIA / MermaIA — checklist reproducible
**Actualización: 17-10-2026.** Este guion propone cómo ver y probar el proyecto. **No hay demo web ejecutable confirmada.**

## Qué corre y qué no
- `main`: bibliotecas TS, siete rutas React diseñadas y agente; **no contiene la aplicación anfitriona**, por lo que `npm run dev` no funciona como en el POS.
- ZIP de Claude entregado al propietario: pruebas del motor, resolución de proveedor LLM; **no incluye contenedor web autónomo**.
- PR #1: tratamiento seguro de lotes vencidos y copy visible, pendiente de fusionar.
- No hay API autorizada con inventario real ni URL Vercel probada.

## Cómo probar lo que sí existe
Con el ZIP de Claude descomprimido, y tras instalar dependencias:
```bash
npm ci
npm test
npm run typecheck
```
**Estos comandos son los previstos por ese ZIP, no pruebas ejecutadas aquí.** Mantener `LLM_PROVIDER=none` y no usar claves reales para la primera revisión.

## Pantallas que habrá que montar en un contenedor web de demostración
| Ruta | Comprobación prevista |
|---|---|
| `/` | KPIs, alertas y briefing provienen de semilla etiquetada |
| `/inventario` | Catálogo, filtros, stock y clase ABC |
| `/vencimientos` | Lotes vencidos separados; ningún descuento/liquidación sugerido |
| `/rotacion` | Velocidad y clasificación según histórico de muestra |
| `/compras` | Cantidad sugerida y razones de comprar/no comprar |
| `/promociones` | Margen calculado, aprobación humana, **jamás** vencidos |
| `/merma` | Conteo frente a teórico; etiquetas de diferencia sin acusación personal |

### Criterios de aceptación del contenedor demo
1. Enrutador y Vite/TanStack configurados, CSS aplicado; todas las rutas navegan en móvil.
2. Banner visible **DATOS SIMULADOS**. Cambios de stock/conteos locales etiquetados; botón restaurar demo.
3. Con `LLM_PROVIDER=none`, todos los informes matemáticos siguen funcionando; el chat explica que está desactivado.
4. No exponer `askInventoryAgent` sin autenticar, ni claves de IA en cliente; demo pública sin endpoints LLM.
5. No inventar ventas, costos ni lead time y no tratar `posible_hurto` como acusación.
6. Comandos de instalación, `typecheck`, pruebas de regresión y build registrados con resultados reales.

La demo web es un **trabajo pendiente**, no se debe anunciar como publicada hasta tener despliegue probado. Ver [estado y coordinación](ESTADO_Y_HANDOFF.md).
