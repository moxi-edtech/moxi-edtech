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
      tieBreakerColumn: "mensalidade_id",
    });

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar vw_radar_inadimplencia:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data ?? []) as any[];
    const riscoPeso: Record<string, number> = {
      critico: 3,
      atencao: 2,
      recente: 1,
    };

    const agrupados = new Map<string, any>();

    for (const row of items) {
      if (!row.aluno_id) continue;
      const key = row.aluno_id as string;
      const valorLinha = Number(row.valor_em_atraso ?? row.valor_previsto ?? 0);
      const diasLinha = Number(row.dias_em_atraso ?? 0);
      const riscoLinha = row.status_risco as string;
      const detalhe = {
        mensalidade_id: row.mensalidade_id,
        data_vencimento: row.data_vencimento,
        dias_em_atraso: diasLinha,
        valor_em_atraso: valorLinha,
        valor_previsto: row.valor_previsto,
        status_mensalidade: row.status_mensalidade,
      };

      if (!agrupados.has(key)) {
        agrupados.set(key, {
          aluno_id: row.aluno_id,
          mensalidade_id: null,
          nome_aluno: row.nome_aluno,
          responsavel: row.responsavel,
          telefone: row.telefone,
          nome_turma: row.nome_turma,
          valor_previsto: row.valor_previsto,
          valor_pago_total: row.valor_pago_total,
          valor_em_atraso: valorLinha,
          data_vencimento: row.data_vencimento,
          dias_em_atraso: diasLinha,
          status_risco: riscoLinha,
          status_mensalidade: row.status_mensalidade,
          mensalidades: [detalhe],
        });
        continue;
      }

      const current = agrupados.get(key);
      current.valor_em_atraso = Number(current.valor_em_atraso ?? 0) + valorLinha;
      current.mensalidades.push(detalhe);
      if (diasLinha > Number(current.dias_em_atraso ?? 0)) {
        current.dias_em_atraso = diasLinha;
        current.data_vencimento = row.data_vencimento;
      }
      if ((riscoPeso[riscoLinha] ?? 0) > (riscoPeso[current.status_risco] ?? 0)) {
        current.status_risco = riscoLinha;
      }
    }

    const agrupadosList = Array.from(agrupados.values());

    const alunoIds = Array.from(
      new Set(agrupadosList.map((i) => i.aluno_id).filter(Boolean))
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

    const enriched = agrupadosList.map((item) => ({
      ...item,
      numero_matricula: item.numero_matricula ?? numeroPorAluno[item.aluno_id] ?? null,
    }));

    const sAny = s as any;
    const { data: cases } = await sAny
      .from("financeiro_cobranca_cases")
      .select("aluno_id, status_operacional, owner_user_id, last_contact_at, next_action_at, sla_at")
      .eq("escola_id", escolaId)
      .in("aluno_id", alunoIds);
    const caseByAluno = new Map<string, any>((cases ?? []).map((c: any) => [c.aluno_id, c]));

    const enrichedWithCases = enriched.map((item) => {
      const c: any = caseByAluno.get(item.aluno_id);
      const dias = Number(item.dias_em_atraso ?? 0);
      const valor = Number(item.valor_em_atraso ?? item.valor_previsto ?? 0);
      const reincidencia = Array.isArray(item.mensalidades) ? Math.min(item.mensalidades.length, 6) : 0;
      const statusOperacional = c?.status_operacional ?? "novo";
      const statusWeight =
        statusOperacional === "escalado" ? 16 :
        statusOperacional === "promessa" ? 8 :
        statusOperacional === "em_contato" ? 4 : 0;
      const scoreBruto =
        Math.min(dias, 90) * 0.45 +
        Math.min(valor / 1000, 40) * 0.9 +
        reincidencia * 3 +
        statusWeight;
      const scorePrioridade = Math.max(0, Math.min(100, Math.round(scoreBruto)));
      return {
        ...item,
        case_status: c?.status_operacional ?? "novo",
        case_owner_user_id: c?.owner_user_id ?? null,
        case_last_contact_at: c?.last_contact_at ?? null,
        case_next_action_at: c?.next_action_at ?? null,
        case_sla_at: c?.sla_at ?? null,
        score_prioridade: scorePrioridade,
      };
    });

    const ordered = [...enrichedWithCases].sort((a: any, b: any) => {
      const s = Number(b.score_prioridade ?? 0) - Number(a.score_prioridade ?? 0);
      if (s !== 0) return s;
      return Number(b.valor_em_atraso ?? 0) - Number(a.valor_em_atraso ?? 0);
    });

    return NextResponse.json({ ok: true, items: ordered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no radar financeiro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
