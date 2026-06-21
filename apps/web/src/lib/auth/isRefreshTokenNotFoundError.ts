export function isRefreshTokenNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";

  return code === "refresh_token_not_found" || message.toLowerCase().includes("refresh token not found");
}
