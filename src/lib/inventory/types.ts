export const CATEGORIES = [
  "lacteos",
  "abarrotes",
  "frescos",
  "bebidas",
  "limpieza",
  "panaderia",
  "carnes",
  "cuidado",
  "congelados",
  "snacks",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  lacteos: "Lácteos",
  abarrotes: "Abarrotes",
  frescos: "Frescos",
  bebidas: "Bebidas",
  limpieza: "Limpieza",
  panaderia: "Panadería",
  carnes: "Carnes",
  cuidado: "Cuidado personal",
  congelados: "Congelados",
  snacks: "Snacks",
};

export type Lot = {
  id: string;
  qty: number;
  expiry: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: Category;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  maxStock: number;
  leadDays: number;
  perishable: boolean;
  lots: Lot[];
  dailySales: number[];
};

export type AbcClass = "A" | "B" | "C";
export type Velocity = "alta" | "media" | "baja" | "muerta";
export type HealthStatus =
  | "agotado"
  | "critico"
  | "bajo"
  | "saludable"
  | "exceso"
  | "vence"
  | "vencido";

export type BuyClass = "comprar_ya" | "comprar_pronto" | "no_comprar" | "descontinuar" | "vigilar";
/** @deprecated Use BuyClass. Kept as alias for older call sites. */
export type OrderAction = BuyClass;

export type ExpiryNivel = "critico" | "alerta" | "vigilar";
export type PromoTipo = "descuento" | "bundle" | "liquidacion";
export type AgentMode = "rapido" | "cuidadoso" | "verificado";
export type Trend = "sube" | "estable" | "baja" | "sin_dato";

export type PromoRec = {
  tipo: PromoTipo;
  discount: number;
  descuento_maximo_pct: number;
  margen_resultante_pct: number;
  perdida_controlada: boolean;
  reason: string;
  justificacion: string;
  urgency: ExpiryNivel;
  bundleSku?: string;
  bundleName?: string;
};

export type BusinessParams = {
  margenMinimo: number;
  vencimientoCriticoDias: number;
  vencimientoAlertaDias: number;
  vencimientoVigilarDias: number;
  sobreStockDias: number;
  stockSeguridadDias: Record<Category, number>;
};

export const DEFAULT_PARAMS: BusinessParams = {
  margenMinimo: 0.25,
  vencimientoCriticoDias: 7,
  vencimientoAlertaDias: 30,
  vencimientoVigilarDias: 60,
  sobreStockDias: 90,
  stockSeguridadDias: {
    lacteos: 4,
    abarrotes: 10,
    frescos: 2,
    bebidas: 7,
    limpieza: 12,
    panaderia: 3,
    carnes: 2,
    cuidado: 14,
    congelados: 10,
    snacks: 8,
  },
};

export type ProductMetrics = {
  product: Product;
  sales7: number;
  sales30: number;
  sales30Prev: number;
  sales30Old: number;
  sales90: number;
  avgDaily: number;
  rotacionMensual: number;
  tendencia: Trend;
  daysCover: number | null;
  nearestExpiry: string | null;
  daysToExpiry: number | null;
  expiredQty: number;
  expiring7Qty: number;
  expiring30Qty: number;
  expiring60Qty: number;
  expiryNivel: ExpiryNivel | null;
  abc: AbcClass;
  velocity: Velocity;
  status: HealthStatus;
  targetStock: number;
  orderQty: number;
  orderAction: BuyClass;
  orderReason: string;
  promo: PromoRec | null;
  stockValue: number;
  marginPct: number;
  datosFaltantes: string[];
};

export type AlertKind = "quiebre" | "vencimiento" | "exceso" | "muerto" | "pedido";

export type InventoryAlert = {
  id: string;
  kind: AlertKind;
  sku: string;
  title: string;
  detail: string;
  severity: "alta" | "media" | "baja";
};

export type CatalogSnapshot = {
  sku: string;
  name: string;
  brand: string;
  category: Category;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  maxStock: number;
  leadDays: number;
  perishable: boolean;
  lots: Lot[];
  sales7: number;
  sales30: number;
  sales30Prev: number;
  sales30Old: number;
  sales90: number;
  avgDaily: number;
};

export type InventoryReport = {
  fecha_analisis: string;
  modo: AgentMode;
  resumen_ejecutivo: string;
  salud_general_inventario: {
    porcentaje_sano: number;
    en_quiebre: number;
    en_sobre_stock: number;
    total_skus_analizados: number;
  };
  alertas_vencimiento: Array<{
    sku: string;
    producto: string;
    dias_para_vencer: number;
    unidades_en_riesgo: number;
    nivel: ExpiryNivel;
    sugerencia: {
      tipo: PromoTipo;
      descuento_maximo_pct: number;
      margen_resultante_pct: number;
      perdida_controlada: boolean;
      justificacion: string;
      bundle?: string;
    };
  }>;
  sugerencias_compra: Array<{
    sku: string;
    producto: string;
    clasificacion: BuyClass;
    rotacion_mensual_promedio: number;
    dias_cobertura_actual: number | null;
    cantidad_sugerida: number;
    justificacion: string;
  }>;
  datos_faltantes_o_incertidumbre: string[];
  proximos_pasos_para_el_usuario: string[];
};

export const BRANCH = "Bodega Puntarenas";
export const COMPANY = "Dyko";
export const AGENT_NAME = "InventarioIA";
