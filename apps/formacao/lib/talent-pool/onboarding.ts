export type PartnerScope = "local" | "global";

const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export function isCorporatePreferredEmail(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return true;
  return !CONSUMER_DOMAINS.has(domain);
}

export function mapOtpVerificationError(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("expired") || normalized.includes("token has expired")) {
    return "Código expirado. Solicite um novo código OTP.";
  }
  if (normalized.includes("invalid") || normalized.includes("token")) {
    return "Código OTP inválido. Confirme os 6 dígitos e tente novamente.";
  }
  return "Não foi possível validar o OTP.";
}

export function resolveOnboardingWelcomeMessage(isVerified: boolean): string {
  if (isVerified) {
    return "A sua identidade corporativa foi verificada automaticamente. Acesso total garantido.";
  }
  return "A sua conta está em análise. Pode explorar os talentos anónimos enquanto ativamos as funcionalidades de entrevista.";
}

export function canAccessGlobalScope(params: {
  scope: PartnerScope;
  loading: boolean;
  itemsCount: number;
  globalCount: number;
}): boolean {
  const showUpsell =
    params.scope === "local" &&
    !params.loading &&
    params.itemsCount === 0 &&
    params.globalCount > 0;

  return showUpsell || params.scope === "global";
}
