import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const Query = z.object({
  ano_letivo_id: z.string().uuid(),
  comparar_ano_letivo_id: z.string().uuid(),
});
const response = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Comparação de volumes canónicos, não de percentuais de aproveitamento.
 * Nunca soma dados de outros tenants nem usa estado universal da sidebar.
 */
export async function GET(req: Request) {
  try {
    const search = new URL(req.url).searchParams;
    const parsed = Query.safeParse({
      ano_letivo_id: search.get("ano_letivo_id"),
      comparar_ano_letivo_id: search.get("comparar_ano_letivo_id"),
    });
    if (!parsed.success) return response({ ok: false, error: "Indique dois anos letivos válidos." }, 400);
    if (parsed.data.ano_letivo_id === parsed.data.comparar_ano_letivo_id) {
      return response({ ok: false, error: "Selecione anos distintos para comparar." }, 400);
    }
    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return response({ ok: false, error: "Não autenticado." }, 401);
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, search.get("escola_id"));
    if (!escolaId) return response({ ok: false, error: "Sem acesso à escola." }, 403);
    const permission = await authorizeTurmasManage(supabase, escolaId, auth.user.id);
    if (!permission.allowed) return response({ ok: false, error: "Sem permissão para comparar indicadores.", }, 403);

    const [left, right] = await Promise.all([
      resolveAcademicYearScope(supabase, { escolaId, requestedAcademicYearId: parsed.data.ano_letivo_id, operation: "READ" }),
      resolveAcademicYearScope(supabase, { escolaId, requestedAcademicYearId: parsed.data.comparar_ano_letivo_id, operation: "READ" }),
    ]);
    if (left.status === "PLANNED" || right.status === "PLANNED") {
      return response({ ok: false, error: "Anos planeados não têm indicadores comparáveis." }, 409);
    }

    async function metrics(year: typeof left) {
      const [turmas, matriculas, historicos] = await Promise.all([
        supabase.from("turmas").select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId).eq("session_id", year.id),
        supabase.from("matriculas").select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId).eq("session_id", year.id),
        supabase.from("historico_anos").select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId).eq("ano_letivo", year.ano),
      ]);
      if (turmas.error || matriculas.error || historicos.error) {
        throw turmas.error ?? matriculas.error ?? historicos.error;
      }
      return {
        ano_letivo_id: year.id, ano: year.ano,
        status: year.status,
        turmas: turmas.count ?? 0,
        matriculas_vinculadas: matriculas.count ?? 0,
        historicos_documentados: historicos.count ?? 0,
      };
    }
    const [atual, comparado] = await Promise.all([metrics(left), metrics(right)]);
    return response({
      ok: true,
      atual, comparado,
      diferenca: {
        turmas: atual.turmas - comparado.turmas,
        matriculas_vinculadas: atual.matriculas_vinculadas - comparado.matriculas_vinculadas,
        historicos_documentados: atual.historicos_documentados - comparado.historicos_documentados,
      },
      metodo: "Contagem exata por escola e sessão. Matrículas sem session_id não são inferidas nem associadas a outro ano.",
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) {
      return response({ ok: false, code: err.code, error: err.message }, err.status);
    }
    console.error("[ArquivoComparacao] Erro ao comparar anos", err);
    return response({ ok: false, error: "Não foi possível comparar os indicadores." }, 500);
  }
}
