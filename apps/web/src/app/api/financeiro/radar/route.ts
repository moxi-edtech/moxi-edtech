import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

function parseMonthRange(monthRef: string) {
  const match = monthRef.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// Radar de Inadimplência
// Usa a view materializada vw_radar_inadimplencia que já consolida dados.
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const anoLetivoId =
      searchParams.get("ano_letivo_id") ||
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      null;
    const anoParam = searchParams.get("ano");
    const mesRef = searchParams.get("mes_ref");
    const turmaId = searchParams.get("turma_id");
    const classeId = searchParams.get("classe_id");
    const anoScope = await resolveAnoLetivoScope(s, escolaId, {
      anoLetivoId,
      ano: anoParam ? parseInt(anoParam, 10) : null,
    });

    const monthRange = mesRef ? parseMonthRange(mesRef) : null;
    
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

    if (monthRange) {
      query = query
        .gte("data_vencimento", monthRange.start)
        .lte("data_vencimento", monthRange.end);
    } else if (anoScope?.dataInicio && anoScope?.dataFim) {
      query = query
        .gte("data_vencimento", anoScope.dataInicio)
        .lte("data_vencimento", anoScope.dataFim);
    }

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
    const turmaPorAluno: Record<string, string | null> = {};
    const turmaNomePorAluno: Record<string, string | null> = {};
    const classeIdPorAluno: Record<string, string | null> = {};
    const classeLabelById = new Map<string, string | null>();

    if (alunoIds.length > 0) {
      const { data: mats, error: matsError } = await s
        .from("matriculas")
        .select("aluno_id, numero_matricula, turma_id, ano_letivo, created_at, turma:turmas(nome, classe_id)")
        .in("aluno_id", alunoIds)
        .eq("escola_id", escolaId)
        .in("status", ["ativo", "ativa", "active"])
        .order("created_at", { ascending: false });

      if (matsError) {
        console.error("Erro ao buscar numeros de matrícula:", matsError.message);
      } else {
        const scopedMatriculas = (mats || []).filter((m: any) => {
          if (!anoScope?.ano) return true;
          return Number(m.ano_letivo ?? 0) === Number(anoScope.ano);
        });

        const classIds = Array.from(
          new Set(
            scopedMatriculas
              .map((m: any) => {
                const turma = Array.isArray(m.turma) ? m.turma[0] : m.turma;
                return turma?.classe_id ? String(turma.classe_id) : null;
              })
              .filter(Boolean)
          )
        ) as string[];

        if (classIds.length > 0) {
          const { data: classesRows, error: classesError } = await s
            .from("classes")
            .select("id, nome")
            .in("id", classIds)
            .eq("escola_id", escolaId);

          if (classesError) {
            console.error("Erro ao buscar classes para radar:", classesError.message);
          } else {
            for (const classe of classesRows || []) {
              classeLabelById.set(String(classe.id), classe.nome ?? null);
            }
          }
        }

        for (const m of scopedMatriculas) {
          if (!m.aluno_id) continue;
          if (numeroPorAluno[m.aluno_id]) continue;

          const turma = Array.isArray((m as any).turma) ? (m as any).turma[0] : (m as any).turma;
          turmaPorAluno[m.aluno_id] = (m as any).turma_id ?? null;
          turmaNomePorAluno[m.aluno_id] = turma?.nome ?? null;
          classeIdPorAluno[m.aluno_id] = turma?.classe_id ?? null;

          if (m.numero_matricula) {
            numeroPorAluno[m.aluno_id] = m.numero_matricula;
          }
        }
      }
    }

    const enriched = agrupadosList
      .map((item) => ({
        ...item,
        numero_matricula: item.numero_matricula ?? numeroPorAluno[item.aluno_id] ?? null,
        turma_id: turmaPorAluno[item.aluno_id] ?? null,
        nome_turma: turmaNomePorAluno[item.aluno_id] ?? item.nome_turma ?? null,
        classe_id: classeIdPorAluno[item.aluno_id] ?? null,
        classe_label:
          (classeIdPorAluno[item.aluno_id] ? classeLabelById.get(String(classeIdPorAluno[item.aluno_id])) : null) ?? null,
      }))
      .filter((item) => !turmaId || turmaId === "todas" || item.turma_id === turmaId)
      .filter((item) => !classeId || classeId === "todas" || item.classe_id === classeId);

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

    return NextResponse.json({
      ok: true,
      anoLetivo: anoScope?.ano ?? null,
      anoLetivoId: anoScope?.id ?? null,
      periodo: {
        inicio: monthRange?.start ?? anoScope?.dataInicio ?? null,
        fim: monthRange?.end ?? anoScope?.dataFim ?? null,
      },
      items: ordered,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado no radar financeiro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
