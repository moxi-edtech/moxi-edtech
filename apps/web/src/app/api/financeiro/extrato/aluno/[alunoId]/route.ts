import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2"; // Keep this import if applyKf2ListInvariants is used elsewhere or in a fallback scenario not shown
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"; // Keep this import if resolveEscolaIdForUser is used elsewhere or in a fallback scenario not shown

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
    
    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    
    // 2. Obter escola_id CONSISTENTE com a busca
    // Usar EXATAMENTE o mesmo método que a busca usa
    const escolaId = user.user_metadata?.escola_id || user.app_metadata?.escola_id;
    
    if (!escolaId) {
      return NextResponse.json({ 
        ok: false, 
        error: "Escola não identificada. Contacte o administrador." 
      }, { status: 400 });
    }
    
    // 3. Usar a MESMA RPC que a busca usa (garante consistência)
    const { data: alunosRPC, error: rpcError } = await supabase.rpc(
      "secretaria_list_alunos_kf2",
      {
        p_escola_id: escolaId,
        p_search: "",
        p_status: "ativo",
        p_page: 1,
        p_page_size: 1,
        p_extra_filter: `alunos.id = '${alunoId}'`
      }
    );
    
    if (rpcError || !alunosRPC || alunosRPC.length === 0) {
      console.error("RPC não encontrou aluno:", { alunoId, escolaId, rpcError });
      
      // Fallback: tentar busca direta (com mesma escola_id)
      const { data: alunoFallback, error: fallbackError } = await supabase
        .from("alunos")
        .select(`
          id,
          nome_completo,
          bi_numero,
          telefone_responsavel,
          escola_id
        `)
        .eq("id", alunoId)
        .eq("escola_id", escolaId)
        .single();
      
      if (fallbackError || !alunoFallback) {
        return NextResponse.json({ 
          ok: false, 
          error: "Aluno não encontrado ou não pertence à sua escola",
          debug: { alunoId, escolaId, userEmail: user.email }
        }, { status: 404 });
      }
      
      return NextResponse.json({
        ok: true,
        aluno: {
          id: alunoFallback.id,
          nome_completo: alunoFallback.nome_completo,
          bi_numero: alunoFallback.bi_numero,
          telefone_responsavel: alunoFallback.telefone_responsavel,
          escola_id: alunoFallback.escola_id
        },
        mensalidades: [],
        total_em_atraso: 0,
        total_pago: 0
      });
    }
    
    const aluno = alunosRPC[0];
    
    // 4. Buscar mensalidades (agora com aluno confirmado)
    const { data: mensalidades, error: mensError } = await supabase
      .from("mensalidades")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("status", "pendente") // Only pending payments
      .order("ano", { ascending: true })
      .order("mes", { ascending: true });
    
    if (mensError) {
      console.error("Erro ao buscar mensalidades:", mensError);
      return NextResponse.json({ ok: false, error: "Erro ao carregar mensalidades" }, { status: 500 });
    }

    // 5. Calcular totais
    const totalEmAtraso = mensalidades?.reduce((sum, m) => sum + (m.valor || 0), 0) || 0;
    
    // 6. Retornar dados consistentes
    return NextResponse.json({
      ok: true,
      aluno: {
        id: aluno.id,
        nome_completo: aluno.nome_completo,
        bi_numero: aluno.bi_numero,
        telefone_responsavel: aluno.telefone_responsavel,
        turma_atual: aluno.turma_atual,
        escola_id: aluno.escola_id
      },
      mensalidades: mensalidades || [],
      total_em_atraso: totalEmAtraso,
      total_pago: 0 // Implementar se necessário, ou calcular a partir das mensalidades (se houver pagas)
    });
    
  } catch (error) {
    console.error("Erro interno no endpoint de extrato:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}