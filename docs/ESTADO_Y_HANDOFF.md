# DYKO — Estado, funcionalidades y entrega a Claude
**Corte:** 17 de octubre de 2026 · **Destinatarios:** responsables de Dyko, Claude y otros asistentes de desarrollo.

> **Advertencia:** este repositorio contiene motores de análisis reutilizables y pantallas diseñadas, pero **NO es todavía una aplicación web independiente que arranque con `npm run dev`**. La UI fue diseñada para un entorno anfitrión. No presentar una imagen o código no ejecutado como despliegue.

## 1. Para qué existe
AgenteInventarioDyko comprende **InventarioIA y MermaIA**, motores que calculan sobre datos proporcionados, generan alertas y proponen decisiones. Un humano aprueba compras, ajustes o descuentos. No se debe ejecutar una orden de compra ni modificar existencias reales automáticamente.

El sistema central Dyko Intelligence aún no está construido. La extensión debe mantenerse independiente y acabar conectándose al POS desde una fuente de datos controlada por el servidor. Reducir la complejidad en las pantallas de empleados.

## 2. Estado de versiones — leer antes de editar

| Ubicación | Qué contiene | Estado |
|---|---|---|
| `main` de este repo | Motores TS y componentes React, rutas de panel, analítica y agente ligado a xAI; archivo `package.json` sin runtime web autónomo | Base histórica, no desplegar como app independiente |
| [PR #1 — vencimientos seguros](https://github.com/DereckVillalobos/AgenteInventarioDyko/pull/1), rama `dyko/seguridad-base-20261014` | Impide promociones ante lotes vencidos, añade tests, corrige copys de las pantallas | Borrador; sin fusionar |
| ZIP `agente-inventario-dyko.zip` y `agente-inventario-dyko.patch` de Claude (15-10-2026) | Proveedores `anthropic`, `openai`, `xai`, `groq`, `custom`, `none`; resolución de proveedor, bucle LLM, pruebas y dependencias corregidas | Código entregado fuera de GitHub; **NO aplicado en `main`** |
| [Issue #2](https://github.com/DereckVillalobos/AgenteInventarioDyko/issues/2) | Asegurar endpoint, datos reales, runtime y conciliación ZIP | Backlog activo |

**Orden de integración:** combinar primero el ZIP de Claude y el PR #1; asegurar que la corrección de vencidos NO se pierda. Probar `npm test`, `npm run typecheck` (cuando existan scripts adecuados) y una pregunta de agente con proveedor simulado antes de usar claves reales.

## 3. Inventario funcional actual

| Ruta / componente | Característica | Origen de información |
|---|---|---|
| `/` Panel | KPIs de inventario, salud del catálogo, alertas, resumen, acceso a agentes | Semillas / estado de demostración |
| `/inventario` | Lista de SKU, cantidades, salud, categoría, clase ABC, ficha y ajuste simulado | Semillas / estado local |
| `/vencimientos` | Alertas por ventanas (crítico 7 d, alerta 30 d, vigilar 60 d), lotes, FEFO | Lotes simulados |
| `/rotacion` | Volumen y velocidad, clases ABC, productos lentos y rápidos | Ventas simuladas |
| `/compras` | `comprar_ya`, `comprar_pronto`, `vigilar`, `no_comprar`, `descontinuar`, cantidades propuestas | Motor matemático |
| `/promociones` | Descuento sugerido según margen y vencimiento | Motor matemático; vencidos bloqueados en PR #1 |
| `/merma` | Conteo físico vs stock teórico, faltantes, sobrantes, discrepancias y riesgo | Conteos simulados |
| Panel de agente | Respuestas y herramientas de InventarioIA/MermaIA, modos `rapido/cuidadoso/verificado` | Agente LLM opcional, NO seguro como endpoint público |

Los motores `src/lib/inventory/analytics.ts` y `src/lib/shrinkage/analytics.ts` **no dependen de una IA generativa**. El motor debe reconocer `sin_dato` si no hay historia de ventas. `posible_hurto` es hipótesis a nivel SKU/zona, nunca acusación a empleado.

## 4. Lo que NO existe todavía
- Base PostgreSQL y repositorio persistente operativo en este proyecto.
- Endpoint de agente con identidad gerencial verificada y catálogos obtenidos del servidor.
- Runtime independiente con configuración Vite/TanStack, aplicación montada, navegación y build/deploy verificado.
- Conexión a las ventas/costos/lotes/conteos reales de Caja.
- Flujo ejecutable de aprobación y auditoría de recomendaciones.
- URL pública de Vercel probada.

**Ejecución actual:** las pruebas y el typecheck son el modo de ejecutar el motor del ZIP de Claude; las rutas React **no se ejecutan solas**. Para ver las siete pantallas es necesario construir un contenedor de demo (montaje React, enrutador, CSS y configuración de build). No inventar una URL de demo hasta desplegarla.

## 5. Pasos acordados con el equipo
1. Reconciliar ZIP/parche de Claude con el PR #1. Proveedor **neutral**, clave únicamente en servidor, `LLM_PROVIDER=none` como modo sin IA.
2. Validar motor y tests, incluyendo que productos vencidos jamás se ofrezcan en liquidación o descuento, y comprobar que promociones de productos vigentes sí sean posibles.
3. Construir **demo ejecutable independiente**, con aviso `DATOS SIMULADOS`, navegador y móviles, sin endpoint público de pago y sin base real.
4. Incorporar datos mediante adaptador autorizando al gerente en **Caja**, sobre `CatalogSnapshot` y `PhysicalCount`; no confiar en datos enviados por el navegador.
5. Cuantificar incertidumbres y no inventar costos, lead times, conteos o tendencias.
6. Integrar finalmente con Dyko Intelligence por eventos versionados, cuando exista.

## 6. Normas de colaboración
- Leer este archivo + PR #1 + issue #2 y el documento equivalente en Caja antes de editar.
- Cada PR indica archivos, comandos de reproducción, pruebas realmente ejecutadas, diferencias con el ZIP de Claude y bloqueantes.
- No activar IA de pago, órdenes automáticas ni operaciones de inventario real para una demo.
- Simplicidad de captura por empleado > número de funciones; agentes analizan, proponen y el gerente decide.

**Repositorio hermano:** https://github.com/DereckVillalobos/dyko-intelligence-caja — su `main` todavía contiene dependencias de Grok y necesita conciliar el ZIP de Claude.
