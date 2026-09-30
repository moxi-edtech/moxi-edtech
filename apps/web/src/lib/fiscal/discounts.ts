import {
  decimal4Add,
  decimal4Div,
  decimal4Mul,
  decimal4Sub,
  parseDecimal4,
  toDecimal4String,
  type Decimal4,
} from "@/lib/fiscal/decimal4";

type DiscountableFiscalItem = {
  quantidade: number;
  preco_unit: number;
  unit_price_base?: number;
  settlement_amount?: number;
  line_discount_pct?: number;
};

const HUNDRED = parseDecimal4("100");

function roundToCent(value: Decimal4): Decimal4 {
  const sign = value < 0n ? -1n : 1n;
  const abs = value < 0n ? -value : value;
  const rounded = ((abs + 50n) / 100n) * 100n;
  return rounded * sign;
}

function pctAmount(base: Decimal4, pct: number | undefined): Decimal4 {
  if (!pct) return 0n;
  return roundToCent(
    decimal4Div(decimal4Mul(base, parseDecimal4(String(pct))), HUNDRED)
  );
}

function allocateCentsProRata(total: Decimal4, weights: Decimal4[]): Decimal4[] {
  if (total === 0n || weights.length === 0) return weights.map(() => 0n);

  const sum = weights.reduce((acc, value) => decimal4Add(acc, value), 0n);
  if (sum <= 0n) return weights.map(() => 0n);

  const totalCents = total / 100n;
  const allocations = weights.map((weight, index) => {
    const numerator = totalCents * weight;
    return {
      index,
      cents: numerator / sum,
      remainder: numerator % sum,
    };
  });

  let allocated = allocations.reduce((acc, row) => acc + row.cents, 0n);
  let remaining = totalCents - allocated;

  const byRemainder = [...allocations].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });

  let cursor = 0;
  while (remaining > 0n) {
    byRemainder[cursor % byRemainder.length].cents += 1n;
    remaining -= 1n;
    cursor += 1;
  }

  const result = new Array<Decimal4>(weights.length).fill(0n);
  for (const row of allocations) {
    result[row.index] = row.cents * 100n;
  }
  return result;
}

export function applyFiscalDiscounts<T extends DiscountableFiscalItem>(
  items: T[],
  globalDiscountPct?: number
): T[] {
  const hasDiscounts =
    (globalDiscountPct ?? 0) > 0 ||
    items.some((item) => (item.line_discount_pct ?? 0) > 0);

  if (!hasDiscounts) return items;

  const prepared = items.map((item, index) => {
    if ((item.settlement_amount ?? 0) > 0) {
      throw new Error(
        `FISCAL_DISCOUNT_MANUAL_SETTLEMENT_CONFLICT: item ${index + 1}`
      );
    }
    if (
      item.unit_price_base != null &&
      Math.abs(item.unit_price_base - item.preco_unit) > 0.0001
    ) {
      throw new Error(
        `FISCAL_DISCOUNT_UNIT_BASE_CONFLICT: item ${index + 1}`
      );
    }

    const quantity = parseDecimal4(String(item.quantidade));
    const baseUnitPrice = parseDecimal4(String(item.preco_unit));
    const gross = decimal4Mul(quantity, baseUnitPrice);
    const lineDiscount = pctAmount(gross, item.line_discount_pct);
    const afterLine = decimal4Sub(gross, lineDiscount);

    if (afterLine < 0n) {
      throw new Error(`FISCAL_DISCOUNT_NEGATIVE_NET: item ${index + 1}`);
    }

    return {
      item,
      quantity,
      baseUnitPrice,
      gross,
      lineDiscount,
      afterLine,
    };
  });

  const subtotalAfterLine = prepared.reduce(
    (acc, row) => decimal4Add(acc, row.afterLine),
    0n
  );
  const globalDiscount = pctAmount(subtotalAfterLine, globalDiscountPct);
  const globalAllocations = allocateCentsProRata(
    globalDiscount,
    prepared.map((row) => row.afterLine)
  );

  return prepared.map((row, index) => {
    const settlement = decimal4Add(
      row.lineDiscount,
      globalAllocations[index] ?? 0n
    );
    const netLine = decimal4Sub(row.gross, settlement);
    if (netLine < 0n) {
      throw new Error(`FISCAL_DISCOUNT_NEGATIVE_NET: item ${index + 1}`);
    }

    const netUnitPrice = decimal4Div(netLine, row.quantity);

    return {
      ...row.item,
      unit_price_base: Number(toDecimal4String(row.baseUnitPrice)),
      preco_unit: Number(toDecimal4String(netUnitPrice)),
      settlement_amount: Number(toDecimal4String(settlement)),
    };
  });
}
