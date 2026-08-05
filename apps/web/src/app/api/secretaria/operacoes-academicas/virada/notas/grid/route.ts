import { NextRequest, NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  const authz = await authorizeEscolaAction(supabase, escolaId, auth.user.id, ["configurar_escola"]);
  if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const turmaId = params.get("turma_id");
  const disciplinaId = params.get("disciplina_id");
  const anoLetivo = Number(params.get("ano_letivo"));
  const trimestre = Number(params.get("trimestre") || 1);
  if (!turmaId || !disciplinaId || !Number.isInteger(anoLetivo) || !Number.isInteger(trimestre)) {
    return NextResponse.json({ ok: false, error: "turma_id, disciplina_id, ano_letivo e trimestre são obrigatórios" }, { status: 400 });
  }

  const { data: turma } = await supabase.from("turmas").select("id,ano_letivo,curso_id,classe_id").eq("id", turmaId).eq("escola_id", escolaId).maybeSingle();
  if (!turma || Number(turma.ano_letivo) !== anoLetivo) return NextResponse.json({ ok: false, error: "Turma não pertence ao ano letivo selecionado" }, { status: 404 });

  const { data: matrizes } = await supabase.from("curso_matriz").select("id").eq("escola_id", escolaId).eq("curso_id", turma.curso_id).eq("classe_id", turma.classe_id).eq("disciplina_id", disciplinaId).eq("ativo", true).limit(1);
  const matrizId = matrizes?.[0]?.id;
  if (!matrizId) return NextResponse.json({ ok: false, error: "Disciplina não está vinculada à matriz da turma" }, { status: 400 });
  const { data: turmaDisciplinas } = await supabase.from("turma_disciplinas").select("id").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("curso_matriz_id", matrizId).limit(1);
  const turmaDisciplinaId = turmaDisciplinas?.[0]?.id;
  if (!turmaDisciplinaId) return NextResponse.json({ ok: false, error: "Disciplina não atribuída à turma" }, { status: 400 });

  const [avaliacoesRes, matriculasRes] = await Promise.all([
    supabase.from("avaliacoes").select("id,nome,tipo,trimestre,nota_max").eq("escola_id", escolaId).eq("turma_disciplina_id", turmaDisciplinaId).eq("ano_letivo", anoLetivo).eq("trimestre", trimestre).order("tipo", { ascending: true }),
    supabase.from("matriculas").select("id,aluno_id,numero_chamada,status,alunos:aluno_id(id,nome,nome_completo,numero_processo)").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("ano_letivo", anoLetivo).not("status", "in", "(rascunho,indefinido)").order("numero_chamada", { ascending: true, nullsFirst: false }).limit(100),
  ]);
  if (avaliacoesRes.error || matriculasRes.error) return NextResponse.json({ ok: false, error: avaliacoesRes.error?.message || matriculasRes.error?.message }, { status: 400 });

  const avaliacaoIds = (avaliacoesRes.data ?? []).map((row: any) => row.id);
  const matriculaIds = (matriculasRes.data ?? []).map((row: any) => row.id);
  const { data: notas } = avaliacaoIds.length && matriculaIds.length
    ? await supabase.from("notas").select("avaliacao_id,matricula_id,valor").eq("escola_id", escolaId).in("avaliacao_id", avaliacaoIds).in("matricula_id", matriculaIds)
    : { data: [] };
  const notaByKey = new Map((notas ?? []).map((row: any) => [`${row.matricula_id}:${row.avaliacao_id}`, row.valor]));

  return NextResponse.json({
    ok: true,
    turma_disciplina_id: turmaDisciplinaId,
    avaliacoes: avaliacoesRes.data ?? [],
    alunos: (matriculasRes.data ?? []).map((row: any) => {
      const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
      return {
        matricula_id: row.id,
        aluno_id: row.aluno_id,
        numero_processo: aluno?.numero_processo ?? null,
        numero_chamada: row.numero_chamada,
        nome: aluno?.nome_completo || aluno?.nome || row.aluno_id,
        status: row.status,
        notas: Object.fromEntries(avaliacaoIds.map((id: string) => [id, notaByKey.get(`${row.id}:${id}`) ?? null])),
      };
    }),
  });
}
