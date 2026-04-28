import {
  decimal4Abs,
  decimal4Add,
  decimal4Cmp,
  decimal4Div,
  decimal4Eq,
  decimal4Mul,
  decimal4Sub,
  parseDecimal4,
  toDecimal4String,
  type Decimal4,
} from "@/lib/fiscal/decimal4";

export type FiscalTaxProfile =
  | { kind: "NORMAL_14"; ratePct: "14.0000" }
  | { kind: "REDUZIDA_5"; ratePct: "5.0000" }
  | { kind: "ISENTO"; ratePct: "0.0000"; exemptionCode: string; exemptionReason: string };

export type FiscalEngineLineInput = {
  lineNo: number;
  productCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineDiscountPct?: string;
  tax: FiscalTaxProfile;
};

export type FiscalEngineInput = {
  escolaId: string;
  tenantEmpresaId: string;
  moeda: string;
  exchangeRateToAoa?: string;
  globalDiscountPct?: string;
  lines: FiscalEngineLineInput[];
};

export type FiscalEngineLineOutput = {
  lineNo: number;
  productCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineGross: string;
  lineDiscount: string;
  lineNetBeforeGlobal: string;
  globalDiscountAllocated: string;
  lineNet: string;
  taxRatePct: string;
  taxAmount: string;
  lineTotal: string;
  settlementAmount: string;
  exemptionCode?: string;
  exemptionReason?: string;
};

export type FiscalEngineOutput = {
  escolaId: string;
  tenantEmpresaId: string;
  moeda: string;
  exchangeRateToAoa: string;
  subtotalBeforeGlobal: string;
  globalDiscountAmount: string;
  subtotalNet: string;
  taxTotal: string;
  grandTotal: string;
  settlementTotal: string;
  lines: FiscalEngineLineOutput[];
};

function pctToFactor(pct: string): Decimal4 {
  return parseDecimal4(pct);
}

function allocateProRata(total: Decimal4, weights: Decimal4[]): Decimal4[] {
  const sum = weights.reduce((acc, w) => decimal4Add(acc, w), 0n);
  if (sum === 0n) return weights.map(() => 0n);

  const base = weights.map((w) => decimal4Div(decimal4Mul(total, w), sum));
  const allocated = base.reduce((acc, v) => decimal4Add(acc, v), 0n);
  let diff = decimal4Sub(total, allocated);

  const result = [...base];
  let i = 0;
  while (!decimal4Eq(diff, 0n) && i < result.length * 2) {
    const idx = i % result.length;
    const step = diff > 0n ? 1n : -1n;
    result[idx] = result[idx] + step;
    diff = diff - step;
    i += 1;
  }

  return result;
}

export function calcularDocumentoDeterministico(input: FiscalEngineInput): FiscalEngineOutput {
  if (!input.escolaId || !input.tenantEmpresaId) throw new Error("FISCAL_ENGINE_TENANT_REQUIRED");
  if (!input.lines.length) throw new Error("FISCAL_ENGINE_EMPTY_LINES");

  const globalDiscountPct = pctToFactor(input.globalDiscountPct ?? "0.0000");
  const hundred = parseDecimal4("100.0000");
  const fx = input.moeda.toUpperCase() === "AOA" ? parseDecimal4("1.0000") : parseDecimal4(input.exchangeRateToAoa ?? "0");

  if (input.moeda.toUpperCase() !== "AOA" && decimal4Cmp(fx, 0n) <= 0) {
    throw new Error("FISCAL_ENGINE_FX_REQUIRED");
  }

  const precomputed = input.lines.map((line) => {
    const qty = parseDecimal4(line.quantity);
    const unit = parseDecimal4(line.unitPrice);
    const lineGross = decimal4Mul(qty, unit);
    const lineDiscPct = pctToFactor(line.lineDiscountPct ?? "0.0000");
    const lineDiscount = decimal4Div(decimal4Mul(lineGross, lineDiscPct), hundred);
    const lineNetBeforeGlobal = decimal4Sub(lineGross, lineDiscount);
    return {
      line,
      qty,
      unit,
      lineGross,
      lineDiscount,
      lineNetBeforeGlobal,
    };
  });

  const subtotalBeforeGlobal = precomputed.reduce(
    (acc, item) => decimal4Add(acc, item.lineNetBeforeGlobal),
    0n
  );
  const globalDiscountAmount = decimal4Div(decimal4Mul(subtotalBeforeGlobal, globalDiscountPct), hundred);
  const weights = precomputed.map((item) => decimal4Abs(item.lineNetBeforeGlobal));
  const globalAllocations = allocateProRata(globalDiscountAmount, weights);

  let taxTotal = 0n;
  let subtotalNet = 0n;
  const lines: FiscalEngineLineOutput[] = precomputed.map((item, idx) => {
    const globalDiscountAllocated = globalAllocations[idx] ?? 0n;
    const lineNet = decimal4Sub(item.lineNetBeforeGlobal, globalDiscountAllocated);
    const taxRate = pctToFactor(item.line.tax.ratePct);
    const taxAmount = decimal4Div(decimal4Mul(lineNet, taxRate), hundred);
    const lineTotal = decimal4Add(lineNet, taxAmount);

    subtotalNet = decimal4Add(subtotalNet, lineNet);
    taxTotal = decimal4Add(taxTotal, taxAmount);

    return {
      lineNo: item.line.lineNo,
      productCode: item.line.productCode,
      description: item.line.description,
      quantity: toDecimal4String(item.qty),
      unitPrice: toDecimal4String(item.unit),
      lineGross: toDecimal4String(item.lineGross),
      lineDiscount: toDecimal4String(item.lineDiscount),
      lineNetBeforeGlobal: toDecimal4String(item.lineNetBeforeGlobal),
      globalDiscountAllocated: toDecimal4String(globalDiscountAllocated),
      lineNet: toDecimal4String(lineNet),
      taxRatePct: item.line.tax.ratePct,
      taxAmount: toDecimal4String(taxAmount),
      lineTotal: toDecimal4String(lineTotal),
      settlementAmount: toDecimal4String(decimal4Add(item.lineDiscount, globalDiscountAllocated)),
      exemptionCode: item.line.tax.kind === "ISENTO" ? item.line.tax.exemptionCode : undefined,
      exemptionReason: item.line.tax.kind === "ISENTO" ? item.line.tax.exemptionReason : undefined,
    };
  });

  const grandTotal = decimal4Add(subtotalNet, taxTotal);

  return {
    escolaId: input.escolaId,
    tenantEmpresaId: input.tenantEmpresaId,
    moeda: input.moeda.toUpperCase(),
    exchangeRateToAoa: toDecimal4String(fx),
    subtotalBeforeGlobal: toDecimal4String(subtotalBeforeGlobal),
    globalDiscountAmount: toDecimal4String(globalDiscountAmount),
    subtotalNet: toDecimal4String(subtotalNet),
    taxTotal: toDecimal4String(taxTotal),
    grandTotal: toDecimal4String(grandTotal),
    settlementTotal: toDecimal4String(globalDiscountAmount),
    lines,
  };
}

export type OrderRefNode = {
  id: string;
  escolaId: string;
  tipoDocumento: "PP" | "FT" | "NC";
  documentoOrigemId?: string | null;
  rectificaDocumentoId?: string | null;
};

export function validarEncadeamentoOrderReferences(node: OrderRefNode, deps: Map<string, OrderRefNode>) {
  if (node.tipoDocumento === "FT") {
    if (!node.documentoOrigemId) return;
    const origin = deps.get(node.documentoOrigemId);
    if (!origin) throw new Error("ORDER_REF_ORIGIN_NOT_FOUND");
    if (origin.escolaId !== node.escolaId) throw new Error("ORDER_REF_CROSS_TENANT");
    if (origin.tipoDocumento !== "PP") throw new Error("ORDER_REF_INVALID_ORIGIN_TYPE");
  }

  if (node.tipoDocumento === "NC") {
    if (!node.rectificaDocumentoId) throw new Error("ORDER_REF_RECTIFICA_REQUIRED");
    const origin = deps.get(node.rectificaDocumentoId);
    if (!origin) throw new Error("ORDER_REF_RECTIFICA_NOT_FOUND");
    if (origin.escolaId !== node.escolaId) throw new Error("ORDER_REF_CROSS_TENANT");
    if (origin.tipoDocumento !== "FT") throw new Error("ORDER_REF_INVALID_RECTIFICA_TYPE");
  }
}

export function assertZeroDivergence(klasse: string, oracle: string) {
  const a = parseDecimal4(klasse);
  const b = parseDecimal4(oracle);
  const diff = decimal4Abs(decimal4Sub(a, b));
  if (!decimal4Eq(diff, 0n)) {
    throw new Error(`FISCAL_DIVERGENCE:${toDecimal4String(diff)}`);
  }
}
