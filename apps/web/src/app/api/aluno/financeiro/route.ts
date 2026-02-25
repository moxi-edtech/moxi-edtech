import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
type MensalidadeRow = {
  id: string;
  ano_referencia: number | null;
  mes_referencia: number | null;
  valor_previsto: number | null;
  data_vencimento: string | null;
  status: string | null;
  data_pagamento_efetiva: string | null;
};

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { alunoId, escolaId, matriculaId, anoLetivo } = ctx;

    if (!alunoId) return NextResponse.json({ ok: true, mensalidades: [] });

    // Busca mensalidades por aluno, no formato do frontend do aluno
    let query = supabase
      .from('mensalidades')
      .select('id, ano_referencia, ano_letivo, mes_referencia, valor_previsto, data_vencimento, status, data_pagamento_efetiva, matricula_id')
      .eq('aluno_id', alunoId);

    if (escolaId) query = query.eq('escola_id', escolaId);
    if (matriculaId) query = query.eq('matricula_id', matriculaId);
    if (typeof anoLetivo === 'number') {
      query = query.or(`ano_referencia.eq.${anoLetivo},ano_letivo.eq.${anoLetivo}`);
    }

    const { data, error } = await query
      .order('ano_referencia', { ascending: true })
      .order('mes_referencia', { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const hoje = new Date().toISOString().slice(0, 10);
    const rows = (data || []).map((m: MensalidadeRow) => {
      const competencia = `${m.ano_referencia}-${String(m.mes_referencia).padStart(2, '0')}`;
      const vencimento = m.data_vencimento ?? "";
      const pago_em = m.data_pagamento_efetiva ?? null;
      let status: 'pago' | 'pendente' | 'atrasado' = 'pendente';
      if ((m.status as string) === 'pago') status = 'pago';
      else if (vencimento && vencimento < hoje) status = 'atrasado';
      else status = 'pendente';
      return {
        id: m.id,
        competencia,
        valor: Number(m.valor_previsto ?? 0),
        vencimento,
        status,
        pago_em,
      };
    });

    return NextResponse.json({ ok: true, mensalidades: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
