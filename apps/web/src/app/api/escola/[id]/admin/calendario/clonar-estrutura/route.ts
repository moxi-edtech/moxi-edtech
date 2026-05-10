import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

type DatabaseWithCloneAcademicStructureRpc = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      clone_academic_structure: {
        Args: {
          p_escola_id: string;
          p_from_ano_id: string;
          p_to_ano_id: string;
          p_clone_professores: boolean;
        };
        Returns: {
          ok: boolean;
          message: string;
          total_cloned: number;
        }[];
      };
    };
  };
};

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<DatabaseWithCloneAcademicStructureRpc>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = await params;
    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);

    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const body = await req.json();
    const { fromAnoId, toAnoId, cloneProfessores = true } = body;

    if (!fromAnoId || !toAnoId) {
      return NextResponse.json({ ok: false, error: 'IDs de origem e destino são obrigatórios.' }, { status: 400 });
    }

    // Chamar RPC de clonagem
    const { data, error: rpcError } = await supabase.rpc('clone_academic_structure', {
      p_escola_id: userEscolaId,
      p_from_ano_id: fromAnoId,
      p_to_ano_id: toAnoId,
      p_clone_professores: cloneProfessores
    });

    if (rpcError) throw rpcError;

    const result = data?.[0];

    return NextResponse.json({ 
      ok: true, 
      message: result?.message ?? 'Estrutura clonada com sucesso.',
      totalCloned: result?.total_cloned ?? 0
    });

  } catch (e: unknown) {
    console.error('Erro ao clonar estrutura acadêmica:', e);
    const errorMessage = e instanceof Error ? e.message : 'Erro interno do servidor.';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
