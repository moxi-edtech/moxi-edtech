import { z } from "zod";

const LoginBodySchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
});

export function extractLoginCredentials(payload: unknown): {
  rawIdentifier: string;
  password: string;
} {
  const parsed = LoginBodySchema.safeParse(payload);
  return {
    rawIdentifier: String(parsed.success ? parsed.data.email ?? "" : "").trim(),
    password: String(parsed.success ? parsed.data.password ?? "" : ""),
  };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return "Credenciais inválidas.";
}

export function mapAuthError(err: unknown): { status: number; message: string } {
  const message = getErrorMessage(err);
  const lower = message.toLowerCase();
  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    Number.isFinite(Number((err as { status?: unknown }).status))
      ? Number((err as { status?: unknown }).status)
      : 401;

  if (lower.includes("confirm") || lower.includes("not confirmed")) {
    return { status: 403, message: "E-mail não confirmado. Verifique sua caixa de entrada." };
  }
  if (
    lower.includes("invalid login") ||
    lower.includes("invalid email") ||
    lower.includes("invalid credentials")
  ) {
    return { status: 401, message: "Credenciais inválidas." };
  }
  if (status === 429 || lower.includes("too many") || lower.includes("rate")) {
    return { status: 429, message: "Muitas tentativas. Tente novamente em alguns minutos." };
  }
  return { status: status >= 400 && status < 600 ? status : 401, message };
}
