import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const withNoStore = (response: NextResponse, start?: number) => {
  response.headers.set("Cache-Control", "no-store");
  if (start !== undefined) {
    response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);
  }
  return response;
};

type WahaStatus = "pending_qr" | "connected" | "disconnected" | "error" | null;

function normalizeWahaStatus(value: unknown): WahaStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return null;

  if (["working", "connected", "authenticated", "open"].includes(status)) {
    return "connected";
  }
  if (["scan_qr_code", "qr", "pending_qr", "pairing", "starting"].includes(status)) {
    return "pending_qr";
  }
  if (["stopped", "disconnected", "closed"].includes(status)) {
    return "disconnected";
  }
  if (["failed", "error", "logout", "logged_out"].includes(status)) {
    return "error";
  }

  return null;
}

function extractStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const json = payload as Record<string, unknown>;
  const data = json.data && typeof json.data === "object" ? json.data as Record<string, unknown> : null;
  const result = json.result && typeof json.result === "object" ? json.result as Record<string, unknown> : null;
  const engine = json.engine && typeof json.engine === "object" ? json.engine as Record<string, unknown> : null;

  const status =
    json.status ||
    json.state ||
    data?.status ||
    data?.state ||
    result?.status ||
    result?.state ||
    engine?.state ||
    null;

  return typeof status === "string" && status.trim() ? status : null;
}

async function authorize(
  requestedEscolaId: string,
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<DBWithRPC>>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado", status: 401, escolaId: null } as const;
  }

  const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!userEscolaId) {
    return { error: "Acesso negado a esta escola.", status: 403, escolaId: null } as const;
  }

  const { data: hasRole, error: rolesError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: userEscolaId,
    p_roles: ["admin_escola", "admin", "admin_financeiro", "staff_admin"],
  });

  if (rolesError) {
    return { error: "Erro ao verificar permissões.", status: 500, escolaId: null } as const;
  }

  if (!hasRole) {
    return { error: "Você não tem permissão para ver o QR do WAHA.", status: 403, escolaId: null } as const;
  }

  return { error: null, status: 200, escolaId: userEscolaId } as const;
}

function getWahaConfig() {
  const baseUrl = (process.env.WAHA_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.WAHA_API_KEY ?? "").trim();

  if (!baseUrl || !apiKey) {
    return { ok: false as const, error: "WAHA não configurado no servidor." };
  }

  const headers: Record<string, string> = {
    Accept: "application/json,image/png",
    "X-Api-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  return { ok: true as const, baseUrl, headers };
}

async function fetchWahaStatus(sessionName: string) {
  const config = getWahaConfig();
  if (!config.ok) return { ok: false as const, error: config.error };

  const candidates = [
    `${config.baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/status`,
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/me`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: config.headers, cache: "no-store" });
      if (!response.ok) continue;

      const json = await response.json().catch(() => null);
      const rawStatus = extractStatus(json);
      const status = normalizeWahaStatus(rawStatus);
      if (rawStatus || status) return { ok: true as const, rawStatus, status };
    } catch {
      // Try next candidate.
    }
  }

  return { ok: false as const, error: "Estado WAHA indisponível." };
}

async function startWahaSession(sessionName: string) {
  const config = getWahaConfig();
  if (!config.ok) return { ok: false as const, error: config.error };

  const candidates = [
    `${config.baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/start`,
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/start`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...config.headers,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      if (response.ok || response.status === 409) return { ok: true as const };
    } catch {
      // Try next candidate.
    }
  }

  return { ok: false as const, error: "Não foi possível iniciar a sessão WAHA." };
}

async function fetchWahaQr(sessionName: string) {
  const config = getWahaConfig();
  if (!config.ok) return { ok: false as const, error: config.error };

  const candidates = [
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/auth/qr?format=image`,
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/auth/qr?format=raw`,
    `${config.baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/qr`,
    `${config.baseUrl}/api/${encodeURIComponent(sessionName)}/qr`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: config.headers, cache: "no-store" });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("image/")) {
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        if (imageBuffer.length > 0) {
          const mimeType = contentType.split(";")[0] || "image/png";
          return {
            ok: true as const,
            qrDataUrl: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
            status: null,
          };
        }
      }

      const json = await response.json().catch(() => null);
      const qr =
        json?.qr ||
        json?.qrCode ||
        json?.qrcode ||
        json?.data?.qr ||
        json?.data?.qrCode ||
        json?.data?.qrcode ||
        json?.result?.qr ||
        json?.result?.qrCode ||
        null;

      if (typeof qr === "string" && qr.trim()) {
        const normalized = qr.startsWith("data:image")
          ? qr
          : `data:image/png;base64,${qr.replace(/^data:image\/png;base64,/, "")}`;
        return { ok: true as const, qrDataUrl: normalized };
      }
    } catch {
      // Try next candidate.
    }
  }

  return { ok: false as const, error: "QR Code indisponível no WAHA neste momento." };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorize(requestedEscolaId, supabase);
    if (auth.error || !auth.escolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), start);
    }

    const admin = supabaseServerRole<DBWithRPC>();
    const { data: provider, error } = await admin
      .from("school_notification_providers")
      .select("status, session_name")
      .eq("school_id", auth.escolaId)
      .eq("provider_type", "whatsapp_waha")
      .maybeSingle();

    if (error) {
      return withNoStore(
        NextResponse.json({ ok: false, error: error.message || "Falha ao carregar sessão WAHA." }, { status: 500 }),
        start
      );
    }

    if (!provider) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "WAHA ainda não foi configurado para esta escola." }, { status: 404 }),
        start
      );
    }

    if (!provider.session_name) {
      return withNoStore(
        NextResponse.json({ ok: true, data: { qrDataUrl: null, status: provider.status, message: "Sessão WAHA sem identificador configurado." } }),
        start
      );
    }

    if (process.env.WAHA_EXPERIMENTAL_ENABLED !== "true") {
      return withNoStore(
        NextResponse.json({
          ok: true,
          data: {
            qrDataUrl: null,
            status: provider.status,
            message: "WAHA experimental está desligado no servidor.",
          },
        }),
        start
      );
    }

    let status = await fetchWahaStatus(provider.session_name);
    if (status.ok && (status.status === "disconnected" || status.status === "error")) {
      await startWahaSession(provider.session_name);
      await new Promise((resolve) => setTimeout(resolve, 500));
      status = await fetchWahaStatus(provider.session_name);
    }

    const qr = await fetchWahaQr(provider.session_name);
    if (!qr.ok) {
      return withNoStore(
        NextResponse.json({
          ok: true,
          data: {
            qrDataUrl: null,
            status: status.ok ? status.status ?? provider.status : provider.status,
            rawStatus: status.ok ? status.rawStatus : null,
            message: status.ok && status.status === "connected"
              ? "Sessão WAHA já pareada. Não há QR pendente para esta sessão."
              : qr.error,
          },
        }),
        start
      );
    }

    return withNoStore(
      NextResponse.json({
        ok: true,
        data: {
          qrDataUrl: qr.qrDataUrl,
          status: status.ok ? status.status ?? "pending_qr" : "pending_qr",
          rawStatus: status.ok ? status.rawStatus : null,
          message: null,
        },
      }),
      start
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}
