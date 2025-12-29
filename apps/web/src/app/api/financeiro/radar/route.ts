import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

// Radar de Inadimplência
// Usa a view materializada vw_radar_inadimplencia que já consolida dados.
export async function GET() {
  try {
    const s = await supabaseServerTyped();
    const { data: { user } } = await s.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }
    
    // A view vw_radar_inadimplencia já filtra por `escola_id = current_tenant_escola_id()`
    // Apenas precisamos garantir que a chamada é autenticada.
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
          // inner join para validar existência do aluno (não retorna dados adicionais ao cliente)
          "alunos!inner(id,deleted_at,status)",
        ].join(", ")
      )
      .is("alunos.deleted_at", null)
      .neq("alunos.status", "inativo")
      .not("aluno_id", "is", null)
      .limit(5000);

    if (error) {
      console.error("Erro ao buscar vw_radar_inadimplencia:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = data ?? [];
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no radar financeiro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
