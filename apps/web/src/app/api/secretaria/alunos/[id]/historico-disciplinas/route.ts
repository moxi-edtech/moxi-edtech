import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";
import { HISTORICAL_DISCIPLINES_PAGE_SIZE, parseHistoricalDisciplineQuery } from "@/lib/academico/historical-discipline-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const ParamsSchema = z.object({ id: z.string().uuid() });

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Detalhe DOCUMENTAL de uma matrícula histórica. Nunca lê de notas operacionais,
 * nunca sintetiza trimestres e nunca permite editar históricos encerrados.
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = ParamsSchema.safeParse(await context.params);
    if (!params.success) return respond({ ok: false, error: "Aluno inválido." }, 400);

    const query = new URL(req.url).searchParams;
    const parsed = parseHistoricalDisciplineQuery(query);
    if (!parsed.ok) return respond({ ok: false, error: parsed.error }, 400);

    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return respond({ ok: false, error: "Não autenticado." }, 401);

    const escolaId = await resolveEscolaIdForUser(supabase as any, auth.user.id, query.get("escola_id"));
    if (!escolaId) return respond({ ok: false, error: "Sem acesso à escola." }, 403);

    const permission = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_ADMIN_SECRETARIA_ROLE_GROUP, "secretaria_financeiro"],
    });
    if (permission.error) return permission.error;

    // Verificação independente: um aluno de outro tenant não pode ser consultado
    // mesmo que um identificador de histórico seja conhecido por terceiros.
    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select("id")
      .eq("id", params.data.id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (alunoError) return respond({ ok: false, error: "Falha ao validar o aluno." }, 500);
    if (!aluno) return respond({ ok: false, error: "Aluno não encontrado nesta escola." }, 404);

    const { data: historico, error: historicoError } = await supabase
      .from("historico_anos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", params.data.id)
      .eq("ano_letivo", parsed.year)
      .maybeSingle();

    if (historicoError) return respond({ ok: false, error: "Falha ao consultar o histórico anual." }, 500);
    if (!historico) {
      return respond({
        ok: true, ano: parsed.year, page: parsed.page,
        page_size: HISTORICAL_DISCIPLINES_PAGE_SIZE, total: 0, items: [],
        fonte: "historico_disciplinas",
      });
    }

    const offset = (parsed.page - 1) * HISTORICAL_DISCIPLINES_PAGE_SIZE;
    const { data, count, error } = await supabase
      .from("historico_disciplinas")
      .select("id, disciplina_id, disciplina_nome, nota_final, media_final, status_final, resultado", { count: "exact" })
      .eq("historico_ano_id", historico.id)
      .order("disciplina_nome", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + HISTORICAL_DISCIPLINES_PAGE_SIZE - 1);

    if (error) return respond({ ok: false, error: "Falha ao consultar as disciplinas documentadas." }, 500);

    return respond({
      ok: true,
      ano: parsed.year,
      page: parsed.page,
      page_size: HISTORICAL_DISCIPLINES_PAGE_SIZE,
      total: count ?? 0,
      fonte: "historico_disciplinas",
      items: (data ?? []).map((row: any) => ({
        id: row.id,
        disciplina_id: row.disciplina_id ?? null,
        disciplina_nome: row.disciplina_nome ?? null,
        nota_final: row.nota_final ?? row.media_final ?? null,
        resultado: row.status_final ?? row.resultado ?? null,
      })),
    });
  } catch (error) {
    console.error("[DossierHistorico] Falha de leitura", error);
    return respond({ ok: false, error: "Não foi possível consultar as disciplinas históricas." }, 500);
  }
}
