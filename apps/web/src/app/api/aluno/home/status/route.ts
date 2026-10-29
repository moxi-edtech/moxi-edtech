import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { carregarCicloVidaAluno } from "@/lib/matriculas/load-student-lifecycle";
import { rotuloSituacaoMatricula, textoResultadoAcademico } from "@/lib/matriculas/lifecycle-status-contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const authorizedIds = ctx.alunoIds;

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, status: null });

    // A matrícula mais recentemente criada pode pertencer a um ano antigo.
    // A projeção SSOT escolhe primeiro a sessão mais recente e o vínculo ativo.
    const [{ data: aluno }, cicloVida] = await Promise.all([
      supabase.from("alunos").select("id, nome, foto_url").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      carregarCicloVidaAluno(supabase, ctx.escolaId, alunoId).catch(() => null),
    ]);
    const corrente = cicloVida?.matriculaCorrente ?? null;
    const { data: matricula } = corrente
      ? await supabase.from("matriculas")
          .select("id, status, turma:turmas(nome, classe:classes(nome)), percentagem_presencas")
          .eq("id", corrente.matriculaId)
          .eq("aluno_id", alunoId)
          .eq("escola_id", ctx.escolaId)
          .maybeSingle()
      : await supabase.from("matriculas")
          .select("id, status, turma:turmas(nome, classe:classes(nome)), percentagem_presencas")
          .eq("aluno_id", alunoId).eq("escola_id", ctx.escolaId)
          .order("ano_letivo", { ascending: false }).order("created_at", { ascending: false })
          .limit(1).maybeSingle();

    const turmaNome = (matricula as any)?.turma?.nome ?? null;
    const classeNome = (matricula as any)?.turma?.classe?.nome ?? null;
    const assiduidade = (matricula as any)?.percentagem_presencas ?? null;

    const estadoAcademico = corrente?.situacaoContextual
      ? (corrente.situacaoContextual === "ano_encerrado"
        ? textoResultadoAcademico(corrente.situacaoResultado ?? "sem_resultado_oficial", corrente.academico.resultadoOficial)
        : rotuloSituacaoMatricula(corrente.situacaoContextual))
      :
      corrente?.estadoOperacional === "ativa" ? "Em curso"
      : corrente?.estadoOperacional === "pendente" ? "Matrícula pendente de confirmação"
      : corrente?.estadoOperacional === "encerrada" && corrente.academico.resultadoOficial
        ? "Ano letivo concluído"
        : corrente?.estadoOperacional === "encerrada" ? "Resultado académico em validação"
          : corrente ? "Revisão necessária"
            : matricula?.status && ["ativo", "ativa", "active"].includes(String(matricula.status).toLowerCase())
              ? "Em curso" : matricula ? "Situação académica em verificação" : "Sem matrícula ativa";

    return NextResponse.json({ 
      ok: true, 
      status: { 
        nome: aluno?.nome ?? "Aluno", 
        foto_url: aluno?.foto_url ?? null,
        turma: turmaNome, 
        classe: classeNome, 
        estadoAcademico,
        assiduidade,
        cicloVida,
        cicloVidaIndisponivel: cicloVida === null
      } 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
