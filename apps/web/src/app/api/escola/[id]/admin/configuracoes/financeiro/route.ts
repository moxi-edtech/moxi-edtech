import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  dia_vencimento_padrao: z.number().int().min(1).max(31),
  multa_atraso_percent: z.number().min(0).max(100),
  juros_diarios_percent: z.number().min(0).max(100),
  bloquear_inadimplentes: z.boolean().optional(),
  moeda: z.string().min(1).optional(),
});

const resolveAnoLetivoAtivo = async (supabase: Awaited<ReturnType<typeof createRouteClient>>, resolvedEscolaId: string) => {
  const { data: anoLetivo } = await supabase
    .from("anos_letivos")
    .select("id, ano")
    .eq("escola_id", resolvedEscolaId)
    .order("ativo", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return anoLetivo ?? null;
};

const fetchConfiguracoesFinanceiro = async (
  supabase: Awaited<ReturnType<typeof createRouteClient>>,
  resolvedEscolaId: string
) => {
  return (supabase as any)
    .from("configuracoes_financeiro")
    .select("dia_vencimento_padrao, multa_atraso_percent, juros_diarios_percent, bloquear_inadimplentes, moeda")
    .eq("escola_id", resolvedEscolaId)
    .maybeSingle();
};

const withNoStore = (response: NextResponse, start?: number) => {
  response.headers.set("Cache-Control", "no-store");
  if (start !== undefined) {
    response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);
  }
  return response;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }), start);
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!resolvedEscolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }), start);
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc("user_has_role_in_school", {
        p_escola_id: resolvedEscolaId,
        p_roles: ["admin_escola", "secretaria", "admin", "financeiro"],
      });

    if (rolesError) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Erro ao verificar permissões." }, { status: 500 }),
        start
      );
    }
    if (!hasRole) {
      return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }), start);
    }

    const anoLetivo = await resolveAnoLetivoAtivo(supabase, resolvedEscolaId);
    if (!anoLetivo) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Ano letivo não encontrado." }, { status: 400 }),
        start
      );
    }

    const { data: configuracoes, error: configError } = await fetchConfiguracoesFinanceiro(supabase, resolvedEscolaId);
    if (configError) {
      return withNoStore(NextResponse.json({ ok: false, error: configError.message }, { status: 500 }), start);
    }

    let tabelaPadraoQuery = supabase
      .from("financeiro_tabelas")
      .select("dia_vencimento, multa_atraso_percentual, multa_diaria")
      .eq("escola_id", resolvedEscolaId)
      .eq("ano_letivo", anoLetivo.ano)
      .is("curso_id", null)
      .is("classe_id", null)

    tabelaPadraoQuery = applyKf2ListInvariants(tabelaPadraoQuery, {
      defaultLimit: 1,
      order: [{ column: 'updated_at', ascending: false }],
    })

    const { data } = await tabelaPadraoQuery.maybeSingle();

    return withNoStore(NextResponse.json({
      ok: true,
      data: {
        dia_vencimento_padrao: configuracoes?.dia_vencimento_padrao ?? data?.dia_vencimento ?? 10,
        multa_atraso_percent: Number(configuracoes?.multa_atraso_percent ?? data?.multa_atraso_percentual ?? 0),
        juros_diarios_percent: Number(configuracoes?.juros_diarios_percent ?? data?.multa_diaria ?? 0),
        bloquear_inadimplentes: configuracoes?.bloquear_inadimplentes ?? false,
        moeda: configuracoes?.moeda ?? "AOA",
      },
    }), start);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return withNoStore(NextResponse.json({ ok: false, error: msg }, { status: 500 }), start);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }), start);
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!resolvedEscolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }), start);
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc("user_has_role_in_school", {
        p_escola_id: resolvedEscolaId,
        p_roles: ["admin_escola", "secretaria", "admin", "financeiro"],
      });

    if (rolesError) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Erro ao verificar permissões." }, { status: 500 }),
        start
      );
    }
    if (!hasRole) {
      return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }), start);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Dados inválidos.", issues: parsed.error.issues }, { status: 400 }),
        start
      );
    }

    const anoLetivo = await resolveAnoLetivoAtivo(supabase, resolvedEscolaId);
    if (!anoLetivo) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "Ano letivo não encontrado." }, { status: 400 }),
        start
      );
    }

    const payload = {
      escola_id: resolvedEscolaId,
      ano_letivo: anoLetivo.ano,
      curso_id: null,
      classe_id: null,
      dia_vencimento: parsed.data.dia_vencimento_padrao,
      multa_atraso_percentual: parsed.data.multa_atraso_percent,
      multa_diaria: parsed.data.juros_diarios_percent,
      valor_matricula: 0,
      valor_mensalidade: 0,
    };

    const { data, error } = await supabase
      .from("financeiro_tabelas")
      .upsert(payload, { onConflict: "escola_id,ano_letivo,curso_id,classe_id" })
      .select("dia_vencimento, multa_atraso_percentual, multa_diaria")
      .single();

    if (error) {
      return withNoStore(NextResponse.json({ ok: false, error: error.message }, { status: 500 }), start);
    }

    const configPayload = {
      escola_id: resolvedEscolaId,
      dia_vencimento_padrao: parsed.data.dia_vencimento_padrao,
      multa_atraso_percent: parsed.data.multa_atraso_percent,
      juros_diarios_percent: parsed.data.juros_diarios_percent,
      bloquear_inadimplentes: parsed.data.bloquear_inadimplentes ?? false,
      moeda: parsed.data.moeda ?? "AOA",
    };

    const { data: configuracoes, error: configError } = await (supabase as any)
      .from("configuracoes_financeiro")
      .upsert(configPayload, { onConflict: "escola_id" })
      .select("dia_vencimento_padrao, multa_atraso_percent, juros_diarios_percent, bloquear_inadimplentes, moeda")
      .single();

    if (configError) {
      return withNoStore(NextResponse.json({ ok: false, error: configError.message }, { status: 500 }), start);
    }

    return withNoStore(NextResponse.json({
      ok: true,
      data: {
        dia_vencimento_padrao: configuracoes?.dia_vencimento_padrao ?? data?.dia_vencimento ?? parsed.data.dia_vencimento_padrao,
        multa_atraso_percent: Number(
          configuracoes?.multa_atraso_percent ?? data?.multa_atraso_percentual ?? parsed.data.multa_atraso_percent
        ),
        juros_diarios_percent: Number(
          configuracoes?.juros_diarios_percent ?? data?.multa_diaria ?? parsed.data.juros_diarios_percent
        ),
        bloquear_inadimplentes: configuracoes?.bloquear_inadimplentes ?? parsed.data.bloquear_inadimplentes ?? false,
        moeda: configuracoes?.moeda ?? parsed.data.moeda ?? "AOA",
      },
    }), start);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return withNoStore(NextResponse.json({ ok: false, error: msg }, { status: 500 }), start);
  }
}
