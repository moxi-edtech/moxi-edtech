export type ExactDecimal = Readonly<{
  coefficient: bigint;
  scale: number;
}>;

export type DecimalInput = string | number | bigint;

function pow10(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error("DECIMAL_SCALE_INVALID");
  }
  return 10n ** BigInt(scale);
}

function expandExponent(raw: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(raw);
  if (!match) return raw;

  const sign = match[1] === "-" ? "-" : "";
  const intPart = match[2];
  const fracPart = match[3] ?? "";
  const exponent = parseInt(match[4], 10);
  const digits = intPart + fracPart;
  const decimalIndex = intPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  }
  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function parseExactDecimal(value: DecimalInput, field = "decimal"): ExactDecimal {
  let raw: string;
  if (typeof value === "bigint") {
    raw = value.toString();
  } else if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`DECIMAL_INVALID:${field}`);
    raw = value.toString();
  } else {
    raw = value.trim();
  }

  if (!raw) throw new Error(`DECIMAL_EMPTY:${field}`);
  raw = expandExponent(raw);

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`DECIMAL_INVALID:${field}`);

  const negative = match[1] === "-";
  const intPart = match[2].replace(/^0+(?=\d)/, "");
  let fracPart = match[3] ?? "";

  while (fracPart.endsWith("0")) fracPart = fracPart.slice(0, -1);

  const scale = fracPart.length;
  const digits = (intPart || "0") + fracPart;
  let coefficient = BigInt(digits || "0");
  if (negative && coefficient !== 0n) coefficient = -coefficient;

  return { coefficient, scale };
}

function align(a: ExactDecimal, b: ExactDecimal) {
  const scale = Math.max(a.scale, b.scale);
  return {
    scale,
    a: a.coefficient * pow10(scale - a.scale),
    b: b.coefficient * pow10(scale - b.scale),
  };
}

export function addExact(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
  const x = align(a, b);
  return normalizeExact({ coefficient: x.a + x.b, scale: x.scale });
}

export function subExact(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
  const x = align(a, b);
  return normalizeExact({ coefficient: x.a - x.b, scale: x.scale });
}

export function mulExact(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
  return normalizeExact({
    coefficient: a.coefficient * b.coefficient,
    scale: a.scale + b.scale,
  });
}

export function cmpExact(a: ExactDecimal, b: ExactDecimal): -1 | 0 | 1 {
  const x = align(a, b);
  if (x.a === x.b) return 0;
  return x.a < x.b ? -1 : 1;
}

export function absExact(value: ExactDecimal): ExactDecimal {
  return value.coefficient < 0n
    ? { coefficient: -value.coefficient, scale: value.scale }
    : value;
}

export function normalizeExact(value: ExactDecimal): ExactDecimal {
  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

export function roundExact(
  value: ExactDecimal,
  targetScale: number,
  mode: "half-up" | "ceil" | "trunc" = "half-up"
): ExactDecimal {
  if (!Number.isInteger(targetScale) || targetScale < 0) {
    throw new Error("DECIMAL_SCALE_INVALID");
  }
  if (value.scale <= targetScale) {
    return {
      coefficient: value.coefficient * pow10(targetScale - value.scale),
      scale: targetScale,
    };
  }

  const divisor = pow10(value.scale - targetScale);
  const quotient = value.coefficient / divisor;
  const remainder = value.coefficient % divisor;
  if (remainder === 0n) return { coefficient: quotient, scale: targetScale };

  let adjusted = quotient;
  if (mode === "ceil" && value.coefficient > 0n) {
    adjusted += 1n;
  } else if (mode === "half-up") {
    const absRemainder = remainder < 0n ? -remainder : remainder;
    if (absRemainder * 2n >= divisor) {
      adjusted += value.coefficient > 0n ? 1n : -1n;
    }
  }

  return { coefficient: adjusted, scale: targetScale };
}

export function exactToString(value: ExactDecimal): string {
  const normalized = normalizeExact(value);
  const negative = normalized.coefficient < 0n;
  const abs = negative ? -normalized.coefficient : normalized.coefficient;
  const digits = abs.toString();

  if (normalized.scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(normalized.scale + 1, "0");
  const split = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, split)}.${padded.slice(split)}`;
}

export function exactToFixed(value: ExactDecimal, scale: number): string {
  const rounded = roundExact(value, scale, "half-up");
  const negative = rounded.coefficient < 0n;
  const abs = negative ? -rounded.coefficient : rounded.coefficient;
  const digits = abs.toString().padStart(scale + 1, "0");
  if (scale === 0) return `${negative ? "-" : ""}${digits}`;
  const split = digits.length - scale;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

/**
 * AGT's JSON schema requires JSON numbers. All authoritative arithmetic must happen
 * before this boundary using ExactDecimal. This function performs transport-only
 * conversion after the final decimal string has already been fixed.
 */
export function exactToJsonNumber(value: ExactDecimal, fixedScale?: number): number {
  const serialized =
    fixedScale === undefined ? exactToString(value) : exactToFixed(value, fixedScale);
  const parsed = JSON.parse(serialized) as unknown;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new Error("DECIMAL_JSON_NUMBER_INVALID");
  }
  return parsed;
}

export function equalRounded(
  a: ExactDecimal,
  b: ExactDecimal,
  scale: number
): boolean {
  return cmpExact(roundExact(a, scale), roundExact(b, scale)) === 0;
}
