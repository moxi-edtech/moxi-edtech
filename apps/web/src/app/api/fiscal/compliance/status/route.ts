import { NextResponse } from "next/server";

import { getFiscalKmsReadiness } from "@/lib/fiscal/kmsReadiness";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

type EmpresaContext = {
  empresaId: string | null;
  source: "binding" | "membership" | "none";
};

function jsonError(status: number, code: string, message: string, details?: JsonRecord) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

async function resolveEmpresaContext({
  supabase,
  userId,
  escolaId,
}: {
  supabase: Awaited<ReturnType<typeof supabaseRouteClient<Database>>>;
  userId: string;
  escolaId: string | null;
}): Promise<EmpresaContext> {
  if (escolaId) {
    const { data: binding } = await supabase
      .from("fiscal_escola_bindings")
      .select("empresa_id, is_primary, effective_from")
      .eq("escola_id", escolaId)
      .is("effective_to", null)
      .order("is_primary", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (binding?.empresa_id) {
      return { empresaId: binding.empresa_id, source: "binding" };
    }
  }

  const { data: membership } = await supabase
    .from("fiscal_empresa_users")
    .select("empresa_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.empresa_id) {
    return { empresaId: membership.empresa_id, source: "membership" };
  }

  return { empresaId: null, source: "none" };
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") === "1";

  try {
    const supabase = await supabaseRouteClient<Database>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const ctx = await resolveEmpresaContext({ supabase, userId: user.id, escolaId });
    const kms = await getFiscalKmsReadiness({ probeSign: probe });

    if (!ctx.empresaId) {
      return NextResponse.json({
        ok: true,
        data: {
          request_id: requestId,
          escola_id: escolaId,
          empresa_id: null,
          source: ctx.source,
          empresa: null,
          metrics: {
            documentos_total: 0,
            documentos_emitidos: 0,
            saft_total: 0,
            saft_failed: 0,
            chaves_ativas: 0,
            series_ativas: 0,
          },
          kms,
        },
      });
    }

    const empresaId = ctx.empresaId;

    const [
      empresaRes,
      docsTotalRes,
      docsEmitidosRes,
      saftTotalRes,
      saftFailedRes,
      chavesAtivasRes,
      seriesAtivasRes,
    ] = await Promise.all([
      supabase
        .from("fiscal_empresas")
        .select("id, nome, nif, status")
        .eq("id", empresaId)
        .maybeSingle(),
      supabase
        .from("fiscal_documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId),
      supabase
        .from("fiscal_documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "emitido"),
      supabase
        .from("fiscal_saft_exports")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId),
      supabase
        .from("fiscal_saft_exports")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "failed"),
      supabase
        .from("fiscal_chaves")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "active"),
      supabase
        .from("fiscal_series")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("ativa", true)
        .is("descontinuada_em", null),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        request_id: requestId,
        escola_id: escolaId,
        empresa_id: empresaId,
        source: ctx.source,
        empresa: empresaRes.data ?? null,
        metrics: {
          documentos_total: docsTotalRes.count ?? 0,
          documentos_emitidos: docsEmitidosRes.count ?? 0,
          saft_total: saftTotalRes.count ?? 0,
          saft_failed: saftFailedRes.count ?? 0,
          chaves_ativas: chavesAtivasRes.count ?? 0,
          series_ativas: seriesAtivasRes.count ?? 0,
        },
        kms,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao obter status de compliance fiscal.";
    return jsonError(500, "FISCAL_COMPLIANCE_STATUS_FAILED", message, {
      request_id: requestId,
    });
  }
}
