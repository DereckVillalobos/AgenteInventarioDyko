export type ShrinkClass =
  | "cuadrado"
  | "merma_operativa"
  | "posible_hurto"
  | "error_probable_conteo"
  | "sobrante"
  | "merma_no_clasificada"
  | "sin_conteo";

export type ShrinkAction =
  | "ninguna"
  | "contar"
  | "recontar"
  | "dar_de_baja"
  | "investigar"
  | "ajustar_teorico";

export type PhysicalCount = {
  sku: string;
  countedQty: number;
  countedAt: string;
  countedBy: string;
};

export type ShrinkParams = {
  hurtoValorMinimo: number;
  hurtoPctMinimo: number;
  errorConteoUnidades: number;
};

export const DEFAULT_SHRINK_PARAMS: ShrinkParams = {
  hurtoValorMinimo: 8000,
  hurtoPctMinimo: 0.08,
  errorConteoUnidades: 1,
};

export type ShrinkageRow = {
  sku: string;
  producto: string;
  unit: string;
  cost: number;
  stockTeorico: number;
  stockFisico: number | null;
  diferencia: number | null;
  valorCrc: number;
  clasificacion: ShrinkClass;
  justificacion: string;
  accion_sugerida: ShrinkAction;
  countedBy: string | null;
  countedAt: string | null;
  perishable: boolean;
  expiredQty: number;
  datosFaltantes: string[];
};

export type ShrinkageReport = {
  fecha_analisis: string;
  fecha_conteo: string | null;
  resumen_ejecutivo: string;
  cobertura_conteo: {
    skus_teoricos: number;
    skus_contados: number;
    porcentaje: number;
  };
  valor_merma_crc: number;
  valor_sobrante_crc: number;
  discrepancias: Array<{
    sku: string;
    producto: string;
    stock_teorico: number;
    stock_fisico: number | null;
    diferencia: number | null;
    valor_crc: number;
    clasificacion: ShrinkClass;
    justificacion: string;
    accion_sugerida: ShrinkAction;
  }>;
  datos_faltantes_o_incertidumbre: string[];
  proximos_pasos_para_el_usuario: string[];
};

export const SHRINK_LABEL: Record<ShrinkClass, string> = {
  cuadrado: "Cuadrado",
  merma_operativa: "Merma operativa",
  posible_hurto: "Posible hurto",
  error_probable_conteo: "Error de conteo",
  sobrante: "Sobrante",
  merma_no_clasificada: "Sin clasificar",
  sin_conteo: "Sin conteo",
};

export const SHRINK_ACTION_LABEL: Record<ShrinkAction, string> = {
  ninguna: "Nada que aprobar",
  contar: "Contar ahora",
  recontar: "Recontar",
  dar_de_baja: "Dar de baja (aprobar)",
  investigar: "Investigar",
  ajustar_teorico: "Ajustar teórico al físico (aprobar)",
};

export const MERMA_AGENT = "MermaIA";
