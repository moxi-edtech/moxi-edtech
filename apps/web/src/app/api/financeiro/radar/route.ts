import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Returns radar data for financial delinquency view
export async function GET() {
  try {
    const s = (await supabaseServer()) as any;

    // Select only the fields the UI expects
    const { data, error } = await s
      .from("vw_radar_inadimplencia")
      .select(
        [
          "mensalidade_id",
          "aluno_id",
          "nome_aluno",
          "responsavel",
          "telefone",
          "nome_turma",
          "valor_previsto",
          "valor_pago_total",
          "valor_em_atraso",
          "data_vencimento",
          "dias_em_atraso",
          "status_risco",
          "status_mensalidade",
        ].join(",")
      )
      .order("dias_em_atraso", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Erro DB ao buscar vw_radar_inadimplencia:", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no radar financeiro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

