import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

type CobrancaRow = {
  status: string;
  enviado_em: string;
  mensalidades?: { valor_previsto?: number | null } | { valor_previsto?: number | null }[] | null;
};

function normalizeMensalidade(mensalidade: CobrancaRow["mensalidades"]) {
  if (!mensalidade) return null;
  return Array.isArray(mensalidade) ? mensalidade[0] ?? null : mensalidade;
}

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await supabase
      .from("financeiro_cobrancas")
      .select("status, enviado_em, mensalidades(valor_previsto)")
      .gte("enviado_em", since.toISOString())
      .order("enviado_em", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as CobrancaRow[];

    const resumo = {
      totalEnviadas: rows.length,
      totalRespondidas: rows.filter((r) => r.status === "respondida").length,
      totalPagos: rows.filter((r) => r.status === "paga").length,
      valorRecuperado: rows.reduce((acc, row) => {
        if (row.status !== "paga") return acc;
        const mensalidade = normalizeMensalidade(row.mensalidades);
        return acc + Number(mensalidade?.valor_previsto ?? 0);
      }, 0),
    };

    const historicoMap = new Map<string, { enviadas: number; respondidas: number; pagos: number }>();
    for (const row of rows) {
      const dateKey = row.enviado_em.slice(0, 10);
      const entry = historicoMap.get(dateKey) ?? { enviadas: 0, respondidas: 0, pagos: 0 };
      entry.enviadas += 1;
      if (row.status === "respondida") entry.respondidas += 1;
      if (row.status === "paga") entry.pagos += 1;
      historicoMap.set(dateKey, entry);
    }

    const historico = Array.from(historicoMap.entries()).map(([date, values]) => ({
      data: date,
      ...values,
    }));

    const taxaResposta =
      resumo.totalEnviadas > 0 ? (resumo.totalRespondidas / resumo.totalEnviadas) * 100 : 0;
    const taxaConversao =
      resumo.totalEnviadas > 0 ? (resumo.totalPagos / resumo.totalEnviadas) * 100 : 0;

    return NextResponse.json(
      {
        ok: true,
        resumo: {
          totalEnviadas: resumo.totalEnviadas,
          totalRespondidas: resumo.totalRespondidas,
          totalPagos: resumo.totalPagos,
          taxaResposta,
          taxaConversao,
          valorRecuperado: resumo.valorRecuperado,
        },
        historico,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
