// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  query: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [
        "secretaria",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
      ],
    });
    if (authz.error) {
      return authz.error;
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    const parsed = searchSchema.safeParse({ query });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || "Query inválida" }, { status: 400 });
    }

    const searchQuery = parsed.data.query.toLowerCase();

    const { data: alunos, error } = await supabase
      .from("alunos")
      .select(
        `
        id, nome, nome_completo, bi_numero, numero_processo,
        matriculas(
            id, status, ano_letivo,
            turmas(nome)
        )
        `
      )
      .eq("escola_id", escolaId)
      .or(
        `nome.ilike.%${searchQuery}%,nome_completo.ilike.%${searchQuery}%,bi_numero.ilike.%${searchQuery}%,numero_processo.ilike.%${searchQuery}%`
      )
      .order("nome", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Erro na busca de alunos:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Inadimplência por aluno, lida do pré-cálculo.
    //
    // A vista é um wrapper `security_invoker` sobre
    // `internal.mv_financeiro_inadimplencia_top`, com índice único
    // (escola_id, aluno_id) e refresh por cron a cada 10 minutos. Lê-la é
    // deliberadamente mais barato do que somar mensalidades vencidas a cada
    // tecla — e é o que o Radar Financeiro já usa, pelo que os dois mostram o
    // mesmo número.
    //
    // Como a MV só contém linhas de quem TEM dívida, um aluno ausente está
    // regular: é isso que o 0 significa abaixo. O valor pode ter até 10 minutos
    // de atraso; o valor autoritativo continua a ser o do dossiê.
    const alunoIds = (alunos || []).map((aluno: any) => aluno.id).filter(Boolean);
    let dividaPorAluno = new Map<string, number>();
    if (alunoIds.length > 0) {
      const { data: inadimplencia, error: erroDivida } = await supabase
        .from("vw_financeiro_inadimplencia_top")
        .select("aluno_id, valor_em_atraso")
        .eq("escola_id", escolaId)
        .in("aluno_id", alunoIds);

      if (erroDivida) {
        // Não vale falhar a busca por causa de um badge: a lista de alunos é o
        // essencial, e sem dívida o badge fica simplesmente ausente.
        console.error("Erro ao ler a inadimplência pré-calculada:", erroDivida);
      } else {
        dividaPorAluno = new Map(
          (inadimplencia || []).map((linha: any) => [
            String(linha.aluno_id),
            Number(linha.valor_em_atraso ?? 0),
          ])
        );
      }
    }

    const formattedAlunos = (alunos || []).map((aluno: any) => {
      const matriculas = Array.isArray(aluno.matriculas) ? aluno.matriculas : [];
      const matriculaAtiva = matriculas.find((matricula: any) => ['ativa', 'ativo'].includes(String(matricula.status ?? '').toLowerCase()));
      const matriculaReferencia = matriculaAtiva ?? [...matriculas]
        .sort((a: any, b: any) => Number(b.ano_letivo ?? 0) - Number(a.ano_letivo ?? 0))[0] ?? null;
      return {
        id: aluno.id,
        nome: aluno.nome_completo || aluno.nome,
        numero_processo: aluno.numero_processo,
        bi_numero: aluno.bi_numero,
        foto_url: null,
        turma: matriculaReferencia?.turmas?.nome || null,
        turma_contexto: matriculaAtiva ? 'Turma atual' : matriculaReferencia ? 'Última turma' : null,
        ano_letivo: matriculaReferencia?.ano_letivo ?? null,
        matricula_id: matriculaAtiva?.id || null,
        total_em_atraso: dividaPorAluno.get(String(aluno.id)) ?? 0,
      };
    });

    return NextResponse.json({ ok: true, alunos: formattedAlunos });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
