import {
  addExact,
  divExact,
  exactToJsonNumber,
  mulExact,
  parseExactDecimal,
  type DecimalInput,
  type ExactDecimal,
} from "@/lib/fiscal/decimal";

export function exactMoney(value: unknown, field = "money"): ExactDecimal {
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "bigint") {
    throw new Error(`FINANCE_DECIMAL_INVALID:${field}`);
  }
  return parseExactDecimal(value as DecimalInput, field);
}

export function sumExact(
  values: Iterable<unknown>,
  field = "money"
): ExactDecimal {
  let total = parseExactDecimal("0");
  for (const value of values) {
    total = addExact(total, exactMoney(value ?? "0", field));
  }
  return total;
}

export function moneyToJson(value: ExactDecimal, scale = 2): number {
  return exactToJsonNumber(value, scale);
}

export function safeCount(value: unknown, field = "count"): number {
  const raw =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : typeof value === "bigint"
          ? value.toString()
          : "0";

  if (!/^\d+$/.test(raw || "0")) {
    throw new Error(`FINANCE_INTEGER_INVALID:${field}`);
  }
  const parsed = JSON.parse(raw || "0") as unknown;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`FINANCE_INTEGER_INVALID:${field}`);
  }
  return parsed;
}

export function percentFromExact(
  numerator: ExactDecimal,
  denominator: ExactDecimal,
  scale = 1
): number {
  if (denominator.coefficient === 0n) return 0;
  const percentage = mulExact(
    divExact(numerator, denominator, Math.max(scale + 4, 6)),
    parseExactDecimal("100")
  );
  return exactToJsonNumber(percentage, scale);
}

export function percentFromCounts(
  numerator: number,
  denominator: number,
  scale = 1
): number {
  if (denominator === 0) return 0;
  return percentFromExact(
    parseExactDecimal(String(numerator)),
    parseExactDecimal(String(denominator)),
    scale
  );
}
