import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    
    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const { searchParams } = new URL(request.url);
    const selectedId = searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });

    if (!alunoId) {
      return NextResponse.json({ ok: false, error: "Dados do aluno não encontrados" }, { status: 400 });
    }

    // --- SEGURANÇA: Verificar se o Cartão de Estudante foi pago ---
    const { data: cardPayment } = await supabase
      .from('servico_pedidos')
      .select('status')
      .eq('escola_id', ctx.escolaId)
      .eq('aluno_id', alunoId)
      .eq('servico_escola_id', 'cc9552ae-d548-44fb-b550-a141ff5925c4') // Cartão de Estudante
      .eq('status', 'granted')
      .limit(1)
      .maybeSingle();

    if (!cardPayment) {
      return NextResponse.json({ 
        ok: false, 
        error: "PENDING_PAYMENT", 
        message: "O acesso à Identidade Digital requer a regularização da taxa do Cartão de Estudante." 
      }, { status: 403 });
    }
    // -------------------------------------------------------------

    // 1. Buscar dados detalhados do aluno
    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select(`
        id,
        nome_completo,
        numero_processo,
        bi_numero,
        documentos,
        profile:profiles(avatar_url)
      `)
      .eq("id", alunoId)
      .single();

    if (alunoError || !aluno) throw alunoError || new Error("Aluno não encontrado");

    const profileAvatar = (aluno.profile as any)?.avatar_url;
    const documentPhoto = (aluno.documentos as any)?.foto_candidato;
    const effectivePhoto = profileAvatar || documentPhoto;

    // Buscar matrícula ativa
    const { data: matricula } = await supabase
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
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .in('status', ['ativo', 'ativa', 'active'])
      .order('ano_letivo', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: escola } = await supabase
      .from("escolas")
      .select("nome, logo_url, login_sigla")
      .eq("id", ctx.escolaId)
      .single();

    // 2. Gerar token de verificação
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://klasse.ao"}/v/${aluno.id}`;

    return NextResponse.json({
      ok: true,
      identidade: {
        nome: aluno.nome_completo,
        processo: aluno.numero_processo,
        bi: aluno.bi_numero,
        foto: effectivePhoto,
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
