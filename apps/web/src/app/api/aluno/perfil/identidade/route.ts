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
    const { data: cardPayments, error: cardPaymentError } = await supabase
      .from('servico_pedidos')
      .select('id')
      .eq('escola_id', ctx.escolaId)
      .eq('aluno_id', alunoId)
      .eq('status', 'granted')
      .or('servico_escola_id.eq.cc9552ae-d548-44fb-b550-a141ff5925c4,servico_codigo.in.(CARTAO,DOC_CARTAO_ESTUDANTE,SERV_SEGUNDA_VIA_CARTAO)')
      .limit(1);
    
    if (cardPaymentError) throw cardPaymentError;

    if (!cardPayments?.[0]) {
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
        profile_id,
        nome_completo,
        numero_processo,
        bi_numero,
        documentos
      `)
      .eq("id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .maybeSingle();

    if (alunoError || !aluno) {
      console.error("[IdentityAPI] Aluno Error:", alunoError);
      throw new Error(alunoError?.message || "Aluno não encontrado");
    }

    const { data: profile } = aluno.profile_id
      ? await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("user_id", aluno.profile_id)
          .maybeSingle()
      : { data: null };

    const profileAvatar = profile?.avatar_url;
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
