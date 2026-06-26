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
    p_roles: ["admin_escola", "admin", "staff_admin"],
  });

  if (rolesError) {
    return { error: "Erro ao verificar permissões.", status: 500, escolaId: null } as const;
  }

  if (!hasRole) {
    return { error: "Você não tem permissão para ver o QR do WAHA.", status: 403, escolaId: null } as const;
  }

  return { error: null, status: 200, escolaId: userEscolaId } as const;
}

async function fetchWahaQr(sessionName: string) {
  const baseUrl = (process.env.WAHA_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.WAHA_API_KEY ?? "").trim();

  if (!baseUrl || !apiKey) {
    return { ok: false as const, error: "WAHA não configurado no servidor." };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Api-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  const candidates = [
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/me`,
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/qr`,
    `${baseUrl}/api/${encodeURIComponent(sessionName)}/qr`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers, cache: "no-store" });
      if (!response.ok) continue;
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

      const status =
        json?.status ||
        json?.data?.status ||
        json?.result?.status ||
        null;

      if (typeof qr === "string" && qr.trim()) {
        const normalized = qr.startsWith("data:image")
          ? qr
          : `data:image/png;base64,${qr.replace(/^data:image\/png;base64,/, "")}`;
        return { ok: true as const, qrDataUrl: normalized, status: typeof status === "string" ? status : null };
      }

      if (typeof status === "string" && status.trim()) {
        return { ok: true as const, qrDataUrl: null, status };
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

    const qr = await fetchWahaQr(provider.session_name);
    if (!qr.ok) {
      return withNoStore(
        NextResponse.json({
          ok: true,
          data: {
            qrDataUrl: null,
            status: provider.status,
            message: qr.error,
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
          status: qr.status ?? provider.status,
          message: qr.qrDataUrl ? null : "Sessão carregada, mas sem QR pendente no momento.",
        },
      }),
      start
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}
