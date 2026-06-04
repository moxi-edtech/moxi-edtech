import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, matriculaId, alunoId } = ctx;

    if (!alunoId || !escolaId) {
      return NextResponse.json({ ok: false, error: "Dados do aluno não encontrados" }, { status: 400 });
    }

    // 1. Buscar dados detalhados do aluno e matrícula atual
    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select(`
        id,
        nome_completo,
        numero_processo,
        bi_numero,
        foto_url:documentos->>foto_candidato
      `)
      .eq("id", alunoId)
      .single();

    if (alunoError || !aluno) throw alunoError || new Error("Aluno não encontrado");

    const { data: matricula } = matriculaId 
      ? await supabase
          .from("matriculas")
          .select(`
            id,
            ano_letivo,
            status,
            turma:turmas(
              nome,
              curso:cursos(nome)
            )
          `)
          .eq("id", matriculaId)
          .maybeSingle()
      : { data: null };

    const { data: escola } = await supabase
      .from("escolas")
      .select("nome, logo_url, login_sigla")
      .eq("id", escolaId)
      .single();

    // 2. Gerar token de verificação (hash simples para o QR Code)
    // Em uma V2 real, isso seria um JWT assinado ou um link para uma página de validação pública
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://klasse.ao"}/v/${aluno.id}`;

    return NextResponse.json({
      ok: true,
      identidade: {
        nome: aluno.nome_completo,
        processo: aluno.numero_processo,
        bi: aluno.bi_numero,
        foto: aluno.foto_url,
        escola: escola?.nome || "Escola",
        escola_logo: escola?.logo_url,
        sigla: escola?.login_sigla,
        curso: (matricula?.turma as any)?.curso?.nome || "Ensino Geral",
        turma: (matricula?.turma as any)?.nome || "—",
        ano_letivo: matricula?.ano_letivo,
        validade: `${matricula?.ano_letivo || new Date().getFullYear()}/12/31`,
        verification_url: verificationUrl
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
