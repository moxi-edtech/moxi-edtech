const MAX_PAYMENT_IDEMPOTENCY_KEY_LENGTH = 200;
const PAYMENT_SCOPE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}$/;

export function buildPaymentIdempotencyKey(
  scope: string,
  rawKey: string | null | undefined,
): string | null {
  const normalizedScope = scope.trim().toLowerCase();
  const normalizedKey = rawKey?.trim() ?? "";

  if (!PAYMENT_SCOPE_PATTERN.test(normalizedScope) || !normalizedKey) {
    return null;
  }

  const key = `${normalizedScope}:${normalizedKey}`;
  return key.length <= MAX_PAYMENT_IDEMPOTENCY_KEY_LENGTH ? key : null;
}
