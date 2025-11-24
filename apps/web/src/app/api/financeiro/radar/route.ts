import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Radar de Inadimplência
// Usa a view materializada vw_radar_inadimplencia que já consolida dados.
export async function GET() {
  try {
    const s = await supabaseServer();

    // Apenas alunos que ainda existem (sem soft delete) e com aluno_id válido.
    // Usamos inner join com 'alunos' para garantir existência e filtramos deleted_at IS NULL.
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
