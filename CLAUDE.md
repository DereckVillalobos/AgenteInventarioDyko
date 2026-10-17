# Instrucciones de colaboración — InventarioIA / MermaIA

**LEER ANTES DE MODIFICAR CÓDIGO:**
1. [Estado real y funcionalidades](docs/ESTADO_Y_HANDOFF.md).
2. [Guion de demo y pruebas](docs/DEMO_Y_VALIDACION.md).
3. [PR #1: vencimientos seguros](https://github.com/DereckVillalobos/AgenteInventarioDyko/pull/1) e [issue #2: integración y proveedor LLM](https://github.com/DereckVillalobos/AgenteInventarioDyko/issues/2).
4. [Repo hermano DYKO Caja](https://github.com/DereckVillalobos/dyko-intelligence-caja) y su `CLAUDE.md`.

## Reconciliación de versiones
- El propietario compartió `agente-inventario-dyko.zip` y `agente-inventario-dyko.patch` entregados por Claude el 15-10-2026. **No están integrados en `main`**.
- La rama `dyko/seguridad-base-20261014` añade prevención de promociones de lotes vencidos y pruebas. No perder esa corrección al aplicar el ZIP.
- El ZIP incluye proveedor LLM configurable `anthropic/openai/xai/groq/custom/none`; `main` aún no lo incluye.
- No hay app independiente ejecutable con `npm run dev`: construir contenedor demo antes de anunciar una URL de Vercel.

## Principios no negociables
- Motores analíticos deterministas independientes del LLM; con `LLM_PROVIDER=none` continúan reportes.
- **Nunca recomendar comercializar productos vencidos**. Próximos a vencer solo con controles de seguridad y aprobación humana.
- `posible_hurto` solo hipótesis técnica por SKU/zona; no acusaciones personales.
- Sin datos falsos presentados como reales. Mostrar `DATOS SIMULADOS` en demo.
- No aceptar catálogos o conteos proporcionados por el navegador como fuentes confiables; el agente consulta fuentes autorizadas y exige rol.
- Sin pedidos automáticos, bajas automáticas ni modelo de IA obligatorio.
- La interconexión con DYKO Intelligence será posterior; contemplar eventos versionados sin depender del sistema central.

## Condición de entrega
Cada cambio con commit/PR, lista de tests realmente corridos, comandos de demo, limitaciones, registro de mejoras y concordancia con las ramas del repo hermano. No publicar claves LLM ni rutas de consumo pagado sin auth.
