export const SCALE = 10000n;

export type Decimal4 = bigint;

function normalizeInput(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("DECIMAL4_INVALID_NUMBER");
    return value.toString();
  }
  const trimmed = value.trim();
  if (!trimmed) throw new Error("DECIMAL4_EMPTY");
  return trimmed;
}

export function parseDecimal4(value: string | number): Decimal4 {
  const normalized = normalizeInput(value);
  const sign = normalized.startsWith("-") ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, "");
  if (!/^\d+(\.\d+)?$/.test(unsigned)) throw new Error(`DECIMAL4_INVALID_FORMAT:${value}`);

  const [intPart, fracRaw = ""] = unsigned.split(".");
  const frac = (fracRaw + "0000").slice(0, 4);
  const scaled = BigInt(intPart) * SCALE + BigInt(frac);
  return scaled * sign;
}

export function toDecimal4String(value: Decimal4): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const intPart = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(4, "0");
  return `${sign}${intPart.toString()}.${frac}`;
}

export function decimal4Add(a: Decimal4, b: Decimal4): Decimal4 {
  return a + b;
}

export function decimal4Sub(a: Decimal4, b: Decimal4): Decimal4 {
  return a - b;
}

export function decimal4Mul(a: Decimal4, b: Decimal4): Decimal4 {
  return (a * b) / SCALE;
}

export function decimal4Div(a: Decimal4, b: Decimal4): Decimal4 {
  if (b === 0n) throw new Error("DECIMAL4_DIV_ZERO");
  return (a * SCALE) / b;
}

export function decimal4Abs(a: Decimal4): Decimal4 {
  return a < 0n ? -a : a;
}

export function decimal4Cmp(a: Decimal4, b: Decimal4): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function decimal4Eq(a: Decimal4, b: Decimal4): boolean {
  return a === b;
}
