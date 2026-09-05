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
export type OrderAction = "urgente" | "pedir" | "no_pedir";
export type PromoUrgency = "alta" | "media" | "baja";

export type PromoRec = {
  discount: number;
  reason: string;
  urgency: PromoUrgency;
};

export type ProductMetrics = {
  product: Product;
  sales7: number;
  sales30: number;
  sales90: number;
  avgDaily: number;
  daysCover: number | null;
  nearestExpiry: string | null;
  daysToExpiry: number | null;
  expiredQty: number;
  expiring14Qty: number;
  abc: AbcClass;
  velocity: Velocity;
  status: HealthStatus;
  targetStock: number;
  orderQty: number;
  orderAction: OrderAction;
  orderReason: string;
  promo: PromoRec | null;
  stockValue: number;
  marginPct: number;
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
  sales90: number;
  avgDaily: number;
};

export const BRANCH = "Bodega Puntarenas";
export const COMPANY = "Dyko";
