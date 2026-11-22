import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const Query = z.object({ ano_letivo_id: z.string().uuid() });
function answer(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Visão por competência e ano, nunca "saldo apenas do ano em ecrã".
 * Reutiliza o read model de propinas security_invoker existente.
 * Nenhuma mensalidade é editada nem ocultada da conta corrente.
 */
export async function GET(req: Request) {
  try {
    const search = new URL(req.url).searchParams;
    const parsed = Query.safeParse({ ano_letivo_id: search.get("ano_letivo_id") });
    if (!parsed.success) return answer({ ok: false, error: "Ano letivo obrigatório." }, 400);
    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return answer({ ok: false, error: "Não autenticado." }, 401);
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, search.get("escola_id"));
    if (!escolaId) return answer({ ok: false, error: "Sem acesso à escola." }, 403);

    const allowed = await requireRoleInSchool({
      supabase, escolaId,
      roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP, "admin_secretaria", "admin_secretario", "diretor"],
    });
    if (allowed.error) return allowed.error;
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.ano_letivo_id, operation: "READ",
    });
    if (year.status === "PLANNED") return answer({ ok: false, error: "Ano futuro não disponível." }, 409);

    const { data, error } = await supabase
      .from("vw_financeiro_propinas_mensal_escola")
      .select("ano_letivo, ano, mes, competencia_mes, total_previsto, total_pago, total_em_atraso")
      .eq("escola_id", escolaId)
      .order("competencia_mes", { ascending: true })
      .limit(501);
    if (error) throw error;
    if ((data ?? []).length > 500) {
      return answer({ ok: false, error: "Mais de 500 competências; não devolver valores financeiros incompletos." }, 409);
    }

    const summed = new Map<number, { ano: number; previsto: number; pago: number; em_atraso: number; competencias: number }>();
    for (const row of data ?? []) {
      const ano = Number(row.ano_letivo);
      if (!Number.isInteger(ano)) continue;
      const item = summed.get(ano) ?? { ano, previsto: 0, pago: 0, em_atraso: 0, competencias: 0 };
      item.previsto += Number(row.total_previsto ?? 0);
      item.pago += Number(row.total_pago ?? 0);
      item.em_atraso += Number(row.total_em_atraso ?? 0);
      item.competencias++;
      summed.set(ano, item);
    }
    const porAno = Array.from(summed.values()).sort((a, b) => b.ano - a.ano);
    const totalEmAtrasoTodosAnos = porAno.reduce((total, row) => total + row.em_atraso, 0);
    const selecionado = summed.get(year.ano) ?? {
      ano: year.ano, previsto: 0, pago: 0, em_atraso: 0, competencias: 0,
    };
    return answer({
      ok: true,
      ano_letivo_id: year.id, ano: year.ano,
      fonte: "vw_financeiro_propinas_mensal_escola",
      selecionado, total_em_atraso_todos_anos: totalEmAtrasoTodosAnos,
      por_ano: porAno,
      aviso: "As dívidas de outros anos continuam na conta corrente. Este painel não altera cobranças.",
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) return answer({ ok: false, code: err.code, error: err.message }, err.status);
    console.error("[ArquivoFinanceiro] Falha da leitura de competências", err);
    return answer({ ok: false, error: "Não foi possível consultar o resumo financeiro." }, 500);
  }
}
