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

    // 4. Buscar a primeira mensalidade aberta.
    // O pagamento rápido precisa respeitar a mesma regra FIFO do RPC financeiro:
    // se uma mensalidade antiga está parcialmente paga, ela continua bloqueante
    // e deve ser sugerida antes de mensalidades futuras.
    const { data: mensalidades, error: mensalidadeError } = await supabase
      .from('mensalidades')
      .select('id, mes_referencia, ano_referencia, valor, valor_pago_total, data_vencimento, status')
      .eq('aluno_id', alunoId)
      .eq('escola_id', escolaId)
      .in('status', ['pendente', 'pago_parcial', 'em_atraso', 'atraso'])
      .order('ano_referencia', { ascending: true, nullsFirst: false })
      .order('mes_referencia', { ascending: true, nullsFirst: false })
      .order('data_vencimento', { ascending: true })
      .limit(10);

    if (mensalidadeError) {
      console.error('❌ Erro ao buscar mensalidades:', mensalidadeError);
      return NextResponse.json({ ok: false, error: 'Erro ao buscar mensalidades' }, { status: 500 });
    }

    const primeiraMensalidade = (mensalidades ?? []).find((mensalidade) => {
      const valorMensalidade = Number(mensalidade?.valor ?? 0);
      const valorPago = Number(mensalidade?.valor_pago_total ?? 0);
      return Math.max(0, valorMensalidade - valorPago) > 0;
    }) ?? null;
    const valorMensalidade = Number(primeiraMensalidade?.valor ?? 0);
    const valorPago = Number(primeiraMensalidade?.valor_pago_total ?? 0);
    const saldoMensalidade = Math.max(0, valorMensalidade - valorPago);

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
      mensalidade: primeiraMensalidade ? {
        id: primeiraMensalidade.id,
        mes: primeiraMensalidade.mes_referencia,
        ano: primeiraMensalidade.ano_referencia,
        valor: saldoMensalidade,
        vencimento: primeiraMensalidade.data_vencimento,
        status: primeiraMensalidade.status
      } : null
    };

    console.log('✅ Dados para pagamento rápido:', resposta);
    return NextResponse.json(resposta);
  } catch (err: any) {
     console.error("Erro pagamento-rapido:", err);
     return NextResponse.json({ ok: false, error: err?.message || "Erro interno" }, { status: 500 });
   }
 }
