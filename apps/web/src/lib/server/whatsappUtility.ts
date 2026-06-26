import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DBWithRPC } from "@/types/supabase-augment";

export const WHATSAPP_ALLOWED_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "direcao",
  "diretoria",
  "secretaria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
] as const;

export const WHATSAPP_SESSION_MANAGER_ROLES = ["admin", "admin_escola", "direcao", "diretoria"] as const;
export const WHATSAPP_FINANCE_ROLES = [
  "admin",
  "admin_escola",
  "direcao",
  "diretoria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
] as const;

export type WhatsappAuth = {
  userId: string;
  escolaId: string;
  role: string | null;
  canManageSession: boolean;
};

export type WahaSessionStatus = "connected" | "pending_qr" | "disconnected" | "error" | "disabled";

export const withNoStore = <T extends Response>(response: T) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export function isWahaEnabled() {
  return process.env.WAHA_EXPERIMENTAL_ENABLED === "true";
}

export async function authorizeWhatsappUser(
  supabase: SupabaseClient<DBWithRPC>,
  requestedEscolaId: string,
  roles: readonly string[] = WHATSAPP_ALLOWED_ROLES
): Promise<{ ok: true; auth: WhatsappAuth } | { ok: false; status: number; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "Não autenticado" };

  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!escolaId) return { ok: false, status: 403, error: "Acesso negado a esta escola." };

  const [{ data: hasRole, error: roleError }, { data: roleRows }] = await Promise.all([
    supabase.rpc("user_has_role_in_school", {
      p_escola_id: escolaId,
      p_roles: [...roles],
    }),
    supabase
      .from("escola_users")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .limit(1),
  ]);

  if (roleError) return { ok: false, status: 500, error: "Erro ao verificar permissões." };
  if (!hasRole) return { ok: false, status: 403, error: "Sem permissão para usar WhatsApp KLASSE." };

  const role = Array.isArray(roleRows) && roleRows.length > 0 ? String(roleRows[0]?.papel ?? "") : null;
  const canManageSession = await userHasAnyRole(supabase, escolaId, WHATSAPP_SESSION_MANAGER_ROLES);

  return { ok: true, auth: { userId: user.id, escolaId, role, canManageSession } };
}

export async function userHasAnyRole(
  supabase: SupabaseClient<DBWithRPC>,
  escolaId: string,
  roles: readonly string[]
) {
  const { data, error } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: escolaId,
    p_roles: [...roles],
  });
  if (error) return false;
  return Boolean(data);
}

export function normalizeWhatsappPhone(raw: string | null | undefined) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("244") ? digits : `244${digits.replace(/^0+/, "")}`;
  if (!/^\d{11,15}$/.test(normalized)) return null;
  return normalized;
}

export function whatsappChatIdFromPhone(raw: string | null | undefined) {
  const normalized = normalizeWhatsappPhone(raw);
  return normalized ? `${normalized}@c.us` : null;
}

export function maskPhone(raw: string | null | undefined) {
  const normalized = normalizeWhatsappPhone(raw);
  if (!normalized) return null;
  return `${normalized.slice(0, 5)}***${normalized.slice(-3)}`;
}

export function hashPhone(raw: string | null | undefined) {
  const normalized = normalizeWhatsappPhone(raw);
  if (!normalized) return null;
  const pepper = process.env.WHATSAPP_PHONE_HASH_PEPPER || process.env.NEXTAUTH_SECRET || "klasse-phone-hash";
  return crypto.createHmac("sha256", pepper).update(normalized).digest("hex");
}

export function interpolateTemplate(body: string, variables: Record<string, string>) {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
}

export function inferApproval(riskLevel: string | null | undefined, messageType: string, templateRequiresApproval?: boolean) {
  return Boolean(
    templateRequiresApproval ||
      riskLevel === "high" ||
      messageType === "finance_charge" ||
      messageType === "ai_generated_draft"
  );
}

export function nextRetryAt(retryCount: number) {
  const minutes = retryCount <= 0 ? 1 : retryCount === 1 ? 5 : 15;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function sanitizeWahaSessionName(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 18) return value;
  return `${value.slice(0, 14)}...${value.slice(-6)}`;
}

export function normalizeWahaStatus(value: unknown): WahaSessionStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (["working", "connected", "authenticated", "open"].includes(status)) return "connected";
  if (["scan_qr_code", "qr", "pending_qr", "pairing", "starting"].includes(status)) return "pending_qr";
  if (["stopped", "disconnected", "closed"].includes(status)) return "disconnected";
  if (["failed", "error", "logout", "logged_out"].includes(status)) return "error";
  return "disconnected";
}

export async function fetchWahaSessionStatus(sessionName: string | null | undefined) {
  if (!isWahaEnabled()) return { status: "disabled" as WahaSessionStatus, rawStatus: "disabled" };
  const baseUrl = (process.env.WAHA_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.WAHA_API_KEY ?? "").trim();
  if (!sessionName || !baseUrl || !apiKey) return { status: "disconnected" as WahaSessionStatus, rawStatus: null };

  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return { status: "disconnected" as WahaSessionStatus, rawStatus: null };
  const json = await response.json().catch(() => null);
  const rawStatus = json && typeof json === "object" ? (json as { status?: unknown }).status : null;
  return { status: normalizeWahaStatus(rawStatus), rawStatus: rawStatus ? String(rawStatus) : null };
}

export async function sendWahaTextMessage(params: {
  sessionName: string;
  phone: string;
  body: string;
  idempotencyKey: string;
}) {
  if (!isWahaEnabled()) throw new Error("WAHA_EXPERIMENTAL_ENABLED=false");
  const baseUrl = (process.env.WAHA_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.WAHA_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) throw new Error("WAHA não configurado no servidor");

  const chatId = whatsappChatIdFromPhone(params.phone);
  if (!chatId) throw new Error("Telefone WhatsApp inválido");

  const response = await fetch(`${baseUrl}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      session: params.sessionName,
      chatId,
      text: params.body,
      id: params.idempotencyKey,
      linkPreview: false,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `WAHA sendText falhou (${response.status})`;
    throw new Error(message);
  }

  return {
    providerMessageId: extractProviderMessageId(payload) ?? params.idempotencyKey,
    payload,
  };
}

export function extractProviderMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const id = record.id;
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    const idRecord = id as Record<string, unknown>;
    const serialized = idRecord._serialized ?? idRecord.serialized;
    if (typeof serialized === "string") return serialized;
    if (typeof idRecord.id === "string") return idRecord.id;
  }
  const key = record.key;
  if (key && typeof key === "object") {
    const keyRecord = key as Record<string, unknown>;
    if (typeof keyRecord.id === "string") return keyRecord.id;
  }
  return null;
}
