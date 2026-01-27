// apps/web/src/app/api/teste-rpc/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const escolaId = searchParams.get('escolaId') || 'f406f5a7-a077-431c-b118-297224925726';
    
    // Testar a RPC com diferentes assinaturas
    const testes = [
      {
        nome: 'Assinatura 1 (como no erro)',
        params: {
          p_escola_id: escolaId,
          p_q: '',
          p_status: 'ativo',
          p_limit: 5,
          p_offset: 0,
          p_ano_letivo: null,
          p_cursor_id: null,
          p_cursor_created_at: null
        }
      },
      {
        nome: 'Assinatura 2 (minimal)',
        params: {
          p_escola_id: escolaId,
          p_q: '',
          p_status: 'ativo',
          p_limit: 5,
          p_offset: 0
        }
      }
    ];
    
    const resultados = [];
    
    for (const teste of testes) {
      // Use the correct argument types for the RPC call
      const rpcArgs: any = {
        p_escola_id: teste.params.p_escola_id,
        p_q: teste.params.p_q,
        p_status: teste.params.p_status,
        p_limit: teste.params.p_limit,
        p_offset: teste.params.p_offset,
        p_ano_letivo: (teste.params as any).p_ano_letivo, // Cast to any to allow for null
        p_cursor_id: (teste.params as any).p_cursor_id, // Cast to any to allow for null
        p_cursor_created_at: (teste.params as any).p_cursor_created_at // Cast to any to allow for null
      };

      // Remove null or undefined properties for RPC calls
      Object.keys(rpcArgs).forEach(key => {
        if (rpcArgs[key] === null || rpcArgs[key] === undefined) {
          delete rpcArgs[key];
        }
      });

      const { data, error } = await supabase.rpc(
        'secretaria_list_alunos_kf2',
        rpcArgs
      );
      
      resultados.push({
        teste: teste.nome,
        params: teste.params,
        sucesso: !error,
        erro: error?.message,
        quantidade: data?.length || 0,
        dados: data?.slice(0, 2) // Mostrar apenas 2 registros
      });
    }
    
    // Verificar se aluno existe
    const { data: aluno } = await supabase
      .from('alunos')
      .select('id, nome_completo, escola_id')
      .eq('id', 'b075374b-2e97-46a0-b466-fd4df427e8d0')
      .single();
    
    return NextResponse.json({
      ambiente: process.env.NODE_ENV,
      supabase_url: process.env.SUPABASE_URL,
      escola_id_testada: escolaId,
      aluno_existe: !!aluno,
      aluno,
      testes_rpc: resultados
    });
    
  } catch (error: any) {
    return NextResponse.json({
      erro: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
