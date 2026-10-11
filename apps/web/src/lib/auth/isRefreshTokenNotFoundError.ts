export function isRefreshTokenNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";

  return code === "refresh_token_not_found" || message.toLowerCase().includes("refresh token not found");
}

export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return name === "AuthSessionMissingError" || message.toLowerCase() === "auth session missing!";
}
