import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

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

    const metaEscolaId =
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      s as any,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }
    
    // A view vw_radar_inadimplencia já filtra por `escola_id = current_tenant_escola_id()`
    // Apenas precisamos garantir que a chamada é autenticada.
    let query = s
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
        ].join(", ")
      )
      .eq("escola_id", escolaId)
      .not("aluno_id", "is", null);

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [
        { column: "data_vencimento", ascending: false },
        { column: "mensalidade_id", ascending: false },
      ],
    });

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar vw_radar_inadimplencia:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = data ?? [];

    const alunoIds = Array.from(
      new Set((items as any[]).map((i) => i.aluno_id).filter(Boolean))
    );

    const numeroPorAluno: Record<string, string | null> = {};

    if (alunoIds.length > 0) {
      const { data: mats, error: matsError } = await s
        .from("matriculas")
        .select("aluno_id, numero_matricula, created_at")
        .in("aluno_id", alunoIds)
        .eq("escola_id", escolaId)
        .order("created_at", { ascending: false });

      if (matsError) {
        console.error("Erro ao buscar numeros de matrícula:", matsError.message);
      } else {
        for (const m of mats || []) {
          if (!m.aluno_id) continue;
          if (numeroPorAluno[m.aluno_id]) continue;
          if (m.numero_matricula) {
            numeroPorAluno[m.aluno_id] = m.numero_matricula;
          }
        }
      }
    }

    const enriched = (items as any[]).map((item) => ({
      ...item,
      numero_matricula: item.numero_matricula ?? numeroPorAluno[item.aluno_id] ?? null,
    }));

    return NextResponse.json({ ok: true, items: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no radar financeiro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
