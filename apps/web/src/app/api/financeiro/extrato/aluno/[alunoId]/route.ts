// apps/web/src/app/api/financeiro/extrato/aluno/[alunoId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2"; // Keep this import if applyKf2ListInvariants is used elsewhere or in a fallback scenario not shown
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"; // Keep this import if resolveEscolaIdForUser is used elsewhere or in a fallback scenario not shown
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";

// --- TYPE INTERFACES (Keep existing interfaces or adjust as needed) ---
interface PaymentRow {
  valor_pago: number | null;
  metodo_pagamento: string | null;
  data_pagamento: string | null;
  conciliado?: boolean | null;
  referencia_externa?: string | null;
}

interface MensalidadeRow {
  id: string;
  escola_id?: string | null;
  aluno_id?: string | null;
  turma_id?: string | null;
  ano_letivo?: number | null;
  mes_referencia?: number | null;
  ano_referencia?: number | null;
  data_vencimento?: string | null;
  data_pagamento_efetiva?: string | null;
  valor_previsto?: number | null;
  valor_pago_total?: number | null;
  status?: string | null;
  observacoes?: string | null;
  pagamentos?: PaymentRow[] | PaymentRow | null;
  valor?: number | null; // Added for new mensalidades structure in the provided code
  mes?: number | null; // Added for new mensalidades structure in the provided code
  ano?: number | null; // Added for new mensalidades structure in the provided code
}

interface ProfileRow {
  numero_login?: string | null;
}

interface TurmaRow {
  id: string;
  nome?: string | null;
  classe?: string | null;
  turno?: string | null;
  ano_letivo?: number | null;
}

interface MatriculaRow {
  id: string;
  ano_letivo?: number | null;
  status?: string | null;
  numero_matricula?: number | null;
  turma?: TurmaRow | TurmaRow[] | null;
}

interface EscolaRow {
  id: string;
  nome?: string | null;
  nif?: string | null;
  numero_fiscal?: string | null;
  telefone?: string | null;
  email?: string | null;
}

interface AlunoRow {
  id: string;
  nome?: string | null;
  bi_numero?: string | null;
  telefone?: string | null;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  escola_id?: string | null;
  profiles?: ProfileRow | ProfileRow[] | null;
  matriculas?: MatriculaRow | MatriculaRow[] | null;
  escolas?: EscolaRow | null;
  nome_completo?: string | null; // Added for new aluno structure in the provided code
  turma_atual?: string | null; // Added for new aluno structure in the provided code
  status?: string | null; // Added for direct query in fallback
}
// --- END TYPE INTERFACES ---

// --- NORMALIZATION FUNCTIONS (Keep existing normalization functions) ---
function normalizeProfile(profile: ProfileRow | ProfileRow[] | null | undefined) {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function normalizeMatriculas(matriculas: MatriculaRow | MatriculaRow[] | null | undefined) {
  if (!matriculas) return [] as MatriculaRow[];
  return Array.isArray(matriculas) ? matriculas : [matriculas];
}

function normalizeTurma(turma: TurmaRow | TurmaRow[] | null | undefined) {
  if (!turma) return null;
  return Array.isArray(turma) ? turma[0] ?? null : turma;
}

function normalizePagamentos(pagamentos: PaymentRow | PaymentRow[] | null | undefined) {
  if (!pagamentos) return [] as PaymentRow[];
  return Array.isArray(pagamentos) ? pagamentos : [pagamentos];
}
// --- END NORMALIZATION FUNCTIONS ---

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alunoId: string }> }
) {
  try {
    const { alunoId } = await params;
    const supabase = await supabaseServer(); // Using supabaseServer directly as per debug endpoint and user's suggestion
    
    console.log(`[EXTRATO-REMOTO] Buscando aluno: ${alunoId}`);
    
    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[EXTRATO-REMOTO] Erro de autenticação:', authError);
      return NextResponse.json({ 
        ok: false, 
        error: "Não autenticado" 
      }, { status: 401 });
    }

    try {
      await requireFeature("doc_qr_code");
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }
    
    console.log(`[EXTRATO-REMOTO] Usuário: ${user.email} (${user.id})`);
    
    // 2. Obter escola_id (usando mesma lógica da busca)
    const escolaId = user.user_metadata?.escola_id || user.app_metadata?.escola_id;
    
    if (!escolaId) {
      console.error('[EXTRATO-REMOTO] Usuário sem escola_id nos metadados');
      return NextResponse.json({ 
        ok: false, 
        error: "Usuário não associado a nenhuma escola" 
      }, { status: 400 });
    }
    
    console.log(`[EXTRATO-REMOTO] Escola ID: ${escolaId}`);
    
    // 3. USAR A RPC COM ASSINATURA CORRETA
    const { data: alunosRPC, error: rpcError } = await supabase.rpc(
      'secretaria_list_alunos_kf2',
      {
        p_escola_id: escolaId,
        p_q: '', // string vazia para não filtrar por nome
        p_status: 'ativo',
        p_limit: 100, // Busca vários e filtra localmente
        p_offset: 0,
        p_ano_letivo: undefined, // ou o ano letivo atual se necessário
        p_cursor_id: undefined,
        p_cursor_created_at: undefined
      }
    );
    
    if (rpcError) {
      console.error('[EXTRATO-REMOTO] Erro na RPC:', rpcError);
      
      // Fallback: busca direta se RPC falhar
      console.log('[EXTRATO-REMOTO] Usando busca direta como fallback');
      const { data: alunoDireto, error: alunoError } = await supabase
        .from('alunos')
        .select(`
          id,
          nome_completo,
          bi_numero,
          telefone_responsavel,
          escola_id,
          status
        `)
        .eq('id', alunoId)
        .eq('escola_id', escolaId)
        .eq('status', 'ativo')
        .single();
      
      if (alunoError || !alunoDireto) {
        console.error('[EXTRATO-REMOTO] Aluno não encontrado (busca direta):', alunoError);
        return NextResponse.json({ 
          ok: false, 
          error: "Aluno não encontrado na sua escola" 
        }, { status: 404 });
      }
      
      // Buscar mensalidades para o aluno encontrado
      const { data: mensalidades } = await supabase
        .from('mensalidades')
        .select('*')
        .eq('aluno_id', alunoId)
        .eq('status', 'pendente')
        .order('ano_referencia', { ascending: true })
        .order('mes_referencia', { ascending: true });
      
      const totalEmAtraso = mensalidades?.reduce((sum, m) => sum + (m.valor || 0), 0) || 0;
      
      return NextResponse.json({
        ok: true,
        aluno: {
          id: alunoDireto.id,
          nome: alunoDireto.nome_completo,
          bi: alunoDireto.bi_numero,
          telefone_responsavel: alunoDireto.telefone_responsavel,
          turma: null,
          escola_id: alunoDireto.escola_id
        },
        mensalidades: mensalidades || [],
        total_em_atraso: totalEmAtraso,
        total_pago: 0,
        fonte: 'busca direta (fallback)'
      });
    }
    
    console.log(`[EXTRATO-REMOTO] RPC retornou ${alunosRPC?.length || 0} alunos`);
    
    // 4. Filtrar pelo alunoId específico
    const alunoEncontrado = (alunosRPC?.find((aluno: any) => aluno.id === alunoId) as any) || null;
    
    if (!alunoEncontrado) {
      console.error('[EXTRATO-REMOTO] Aluno não encontrado na lista RPC');
      return NextResponse.json({ 
        ok: false, 
        error: "Aluno não encontrado na sua escola",
        debug: {
          totalAlunosRetornados: alunosRPC?.length,
          alunoIdsRetornados: alunosRPC?.map((a: any) => a.id).slice(0, 5)
        }
      }, { status: 404 });
    }
    
    console.log(`[EXTRATO-REMOTO] Aluno encontrado: ${alunoEncontrado.nome || alunoEncontrado.nome_completo || alunoEncontrado.id}`);
    
    // 5. Buscar mensalidades
    const { data: mensalidades, error: mensError } = await supabase
      .from('mensalidades')
      .select('*')
      .eq('aluno_id', alunoId)
      .eq('status', 'pendente')
      .order('ano_referencia', { ascending: true })
      .order('mes_referencia', { ascending: true });
    
    if (mensError) {
      console.error('[EXTRATO-REMOTO] Erro ao buscar mensalidades:', mensError);
    }
    
    // 6. Calcular total
    const totalEmAtraso = mensalidades?.reduce((sum, m) => sum + (m.valor || 0), 0) || 0;
    
    // 7. Retornar sucesso
    return NextResponse.json({
      ok: true,
      aluno: {
        id: alunoEncontrado.id,
        nome: alunoEncontrado.nome || alunoEncontrado.nome_completo || "",
        bi: alunoEncontrado.bi_numero,
        telefone_responsavel: alunoEncontrado.telefone_responsavel,
        turma: alunoEncontrado.turma_atual ?? null,
        escola_id: alunoEncontrado.escola_id
      },
      mensalidades: mensalidades || [],
      total_em_atraso: totalEmAtraso,
      total_pago: 0,
      fonte: 'RPC secretaria_list_alunos_kf2'
    });
    
  } catch (error: any) {
    console.error('[EXTRATO-REMOTO] Erro interno:', error);
    
    return NextResponse.json({
      ok: false,
      error: "Erro interno do servidor",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
