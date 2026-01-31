import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // awaitable params for Next 15
) {
  try {
    const { id: alunoId } = await context.params;
    const supabase = await createClient();

    console.log(`🔍 Buscando dados para pagamento rápido do aluno: ${alunoId}`);

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    // 2. Buscar escola do usuário
    const { data: perfil } = await supabase
      .from('profiles')
      .select('escola_id, current_escola_id')
      .eq('user_id', user.id)
      .single();

    const escolaId = perfil?.current_escola_id || perfil?.escola_id;
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    // 3. Buscar aluno com UMA mensalidade pendente (a mais antiga)
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select(`
        id,
        nome,
        bi_numero,
        telefone_responsavel,
        matriculas!left(
          turma: turmas(nome)
        )
      `)
      .eq('id', alunoId)
      .eq('escola_id', escolaId)
      .eq('status', 'ativo')
      .single();

    if (alunoError || !aluno) {
      console.error('❌ Aluno não encontrado:', alunoError);
      return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 });
    }

    // 4. Buscar a primeira mensalidade pendente
    const { data: mensalidades, error: mensalidadeError } = await supabase
      .from('mensalidades')
      .select('id, mes_referencia, ano_referencia, valor, data_vencimento, status')
      .eq('aluno_id', alunoId)
      .eq('escola_id', escolaId)
      .eq('status', 'pendente')
      .order('data_vencimento', { ascending: true })
      .limit(1);

    if (mensalidadeError) {
      console.error('❌ Erro ao buscar mensalidades:', mensalidadeError);
      return NextResponse.json({ ok: false, error: 'Erro ao buscar mensalidades' }, { status: 500 });
    }

    // 5. Formatar resposta
    const resposta = {
      ok: true,
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        bi: aluno.bi_numero,
        telefone: aluno.telefone_responsavel,
        turma: aluno.matriculas?.[0]?.turma?.nome || 'Turma não definida'
      },
      mensalidade: mensalidades && mensalidades.length > 0 ? {
        id: mensalidades[0].id,
        mes: mensalidades[0].mes_referencia,
        ano: mensalidades[0].ano_referencia,
        valor: mensalidades[0].valor,
        vencimento: mensalidades[0].data_vencimento,
        status: mensalidades[0].status
      } : null
    };

    console.log('✅ Dados para pagamento rápido:', resposta);
    return NextResponse.json(resposta);
  } catch (err: any) {
     console.error("Erro pagamento-rapido:", err);
     return NextResponse.json({ ok: false, error: err?.message || "Erro interno" }, { status: 500 });
   }
 }
