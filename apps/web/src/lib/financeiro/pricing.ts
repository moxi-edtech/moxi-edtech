// apps/web/src/lib/financeiro/pricing.ts
// Resolve mensalidade por hierarquia: classe > curso > escola (default)

export type MensalidadeRule = {
  valor?: number;
  dia_vencimento?: number | null;
  source: 'classe' | 'curso' | 'escola' | 'none';
};

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type MensalidadeRow = Database["public"]["Tables"]["tabelas_mensalidade"]["Row"];

export async function resolveMensalidade(
  client: SupabaseClient<Database>,
  escolaId: string,
  opts: { classeId?: string | null; cursoId?: string | null }
): Promise<MensalidadeRule> {
  const classeId = opts.classeId || null;
  const cursoId = opts.cursoId || null;

  try {
    // 1) Classe
    if (classeId) {
      const { data } = await client
        .from('tabelas_mensalidade')
        .select('valor, dia_vencimento')
        .eq('escola_id', escolaId)
        .eq('classe_id', classeId)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0] as MensalidadeRow;
        return { valor: Number(row.valor), dia_vencimento: row.dia_vencimento ?? null, source: 'classe' };
      }
    }

    // 2) Curso
    if (cursoId) {
      const { data } = await client
        .from('tabelas_mensalidade')
        .select('valor, dia_vencimento')
        .eq('escola_id', escolaId)
        .eq('curso_id', cursoId)
        .is('classe_id', null)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0] as MensalidadeRow;
        return { valor: Number(row.valor), dia_vencimento: row.dia_vencimento ?? null, source: 'curso' };
      }
    }

    // 3) Escola (default)
    {
      const { data } = await client
        .from('tabelas_mensalidade')
        .select('valor, dia_vencimento')
        .eq('escola_id', escolaId)
        .is('curso_id', null)
        .is('classe_id', null)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0] as MensalidadeRow;
        return { valor: Number(row.valor), dia_vencimento: row.dia_vencimento ?? null, source: 'escola' };
      }
    }

    return { source: 'none' };
  } catch {
    return { source: 'none' };
  }
}
