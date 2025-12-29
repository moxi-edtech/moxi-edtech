import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const targetTurmaId = String(body?.turma_id || "").trim();

  if (!targetTurmaId) {
    return NextResponse.json({ ok: false, error: "turma_id é obrigatório" }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Configuração SUPABASE incompleta" }, { status: 500 });
  }

  const admin = createClient<Database>(adminUrl, serviceKey);

  const { data: matricula, error: matErr } = await admin
    .from("matriculas")
    .select("id, aluno_id, turma_id, ano_letivo, escola_id, turmas(curso_id, classe_id)")
    .eq("id", matriculaId)
    .maybeSingle();
  if (matErr || !matricula) {
    return NextResponse.json({ ok: false, error: matErr?.message || "Matrícula não encontrada" }, { status: 404 });
  }

  const escolaId = (matricula as any).escola_id as string;
  const { data: targetTurma, error: turmaErr } = await admin
    .from("turmas")
    .select("id, escola_id, curso_id, classe_id, ano_letivo")
    .eq("id", targetTurmaId)
    .maybeSingle();
  if (turmaErr || !targetTurma) {
    return NextResponse.json({ ok: false, error: turmaErr?.message || "Turma destino não encontrada" }, { status: 404 });
  }
  if ((targetTurma as any).escola_id !== escolaId) {
    return NextResponse.json({ ok: false, error: "Turma de destino não pertence à mesma escola" }, { status: 400 });
  }

  const anoLetivoDestino = (targetTurma as any).ano_letivo || (matricula as any).ano_letivo;

  const resolverPreco = async (cursoId?: string | null, classeId?: string | null) => {
    try {
      const { tabela } = await resolveTabelaPreco(admin as any, {
        escolaId,
        anoLetivo: anoLetivoDestino,
        cursoId: cursoId || undefined,
        classeId: classeId || undefined,
        allowMensalidadeFallback: true,
      });
      return Number((tabela as any)?.valor_mensalidade || 0);
    } catch {
      return 0;
    }
  };

  const currentTurma = (matricula as any).turmas as any;
  const valorAtual = await resolverPreco(currentTurma?.curso_id, currentTurma?.classe_id);
  const valorNovo = await resolverPreco((targetTurma as any).curso_id, (targetTurma as any).classe_id);

  // Atualiza a matrícula
  const { error: updateErr } = await admin
    .from("matriculas")
    .update({ turma_id: targetTurmaId, status: 'ativo' })
    .eq("id", matriculaId)
    .eq("escola_id", escolaId);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 });
  }

  let parcelasAtualizadas = 0;
  if (valorNovo !== valorAtual) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: abertas, error: abertasErr } = await admin
      .from("mensalidades")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", (matricula as any).aluno_id)
      .eq("ano_referencia", Number(anoLetivoDestino))
      .not("status", "eq", "pago")
      .gte("data_vencimento", hoje);
    if (abertasErr) {
      return NextResponse.json({ ok: false, error: abertasErr.message }, { status: 400 });
    }

    const ids = (abertas || []).map((m: any) => m.id);
    if (ids.length > 0) {
      const { error: updMens } = await admin
        .from("mensalidades")
        .update({ valor_previsto: valorNovo, valor: valorNovo })
        .in("id", ids);
      if (updMens) {
        return NextResponse.json({ ok: false, error: updMens.message }, { status: 400 });
      }
      parcelasAtualizadas = ids.length;
    }
  }

  return NextResponse.json({
    ok: true,
    financeiro: {
      valor_antigo: valorAtual,
      valor_novo: valorNovo,
      parcelas_atualizadas: parcelasAtualizadas,
    },
  });
}
