export type PasswordSignInFailure =
  | "invalid_credentials"
  | "email_unconfirmed"
  | "rate_limited"
  | "unavailable";

/**
 * Supabase Auth timeouts/5xx must never be surfaced as invalid passwords.
 * Only explicit invalid-credential responses can trigger identifier fallbacks.
 */
export function classifyPasswordSignInError(error: unknown): PasswordSignInFailure {
  if (!error || typeof error !== "object") return "unavailable";

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const status = typeof candidate.status === "number" ? candidate.status : NaN;
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  if (
    status === 429 ||
    code.includes("rate_limit") ||
    message.includes("too many requests")
  ) {
    return "rate_limited";
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "email_unconfirmed";
  }

  if (status === 408 || status >= 500) return "unavailable";

  if (
    code === "invalid_credentials" ||
    code === "invalid_login_credentials" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "invalid_credentials";
  }

  // Fail closed. Network failures, unexpected 4xx and malformed responses
  // are not evidence that a user's password is wrong.
  return "unavailable";
}
