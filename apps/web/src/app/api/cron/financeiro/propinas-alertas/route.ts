import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { dispatchAlunoNotificacao } from "@/lib/notificacoes/dispatchAlunoNotificacao";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase client indisponível" }, { status: 500 });
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venceEm3Dias = new Date(hoje);
  venceEm3Dias.setDate(venceEm3Dias.getDate() + 3);

  const { data: pendentes, error } = await supabase
    .from("mensalidades")
    .select("id, escola_id, aluno_id, data_vencimento, status")
    .eq("status", "pendente")
    .gte("data_vencimento", new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString())
    .lte("data_vencimento", venceEm3Dias.toISOString());

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const atrasos = new Map<string, { escolaId: string; alunoId: string; dias: number }>();
  const vencimentos = new Map<string, { escolaId: string; alunoId: string }>();

  (pendentes ?? []).forEach((row) => {
    if (!row.data_vencimento || !row.aluno_id || !row.escola_id) return;
    const vencimento = new Date(row.data_vencimento);
    vencimento.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((hoje.getTime() - vencimento.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays > 0) {
      atrasos.set(row.id, { escolaId: row.escola_id, alunoId: row.aluno_id, dias: diffDays });
    } else if (diffDays === -3) {
      vencimentos.set(row.id, { escolaId: row.escola_id, alunoId: row.aluno_id });
    }
  });

  for (const item of atrasos.values()) {
    await dispatchAlunoNotificacao({
      escolaId: item.escolaId,
      key: "PROPINA_ATRASO",
      alunoIds: [item.alunoId],
      params: { dias: item.dias, actionUrl: "/aluno/financeiro" },
      actorRole: "sistema",
      agrupamentoTTLHoras: 24,
    });
  }

  for (const item of vencimentos.values()) {
    await dispatchAlunoNotificacao({
      escolaId: item.escolaId,
      key: "PROPINA_VENCE_3D",
      alunoIds: [item.alunoId],
      params: { actionUrl: "/aluno/financeiro" },
      actorRole: "sistema",
      agrupamentoTTLHoras: 24,
    });
  }

  return NextResponse.json({
    ok: true,
    atrasos: atrasos.size,
    vencimentos: vencimentos.size,
  });
}
