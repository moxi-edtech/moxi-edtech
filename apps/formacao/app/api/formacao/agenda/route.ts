import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const ACTIVE_INSCRICAO_ESTADOS = new Set(["inscrito", "cursando", "concluido"]);

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isOperationalCohort(status: unknown) {
  const value = String(status ?? "").toLowerCase();
  return !value.includes("cancel") && !value.includes("concl") && !value.includes("fech");
}

function isSummaryOpen(aula: any) {
  return String(aula?.status ?? "") !== "realizada" || !String(aula?.conteudo_realizado ?? "").trim();
}

function formatNameList(names: string[]) {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  if (unique.length === 0) return "sem nome";
  const shown = unique.slice(0, 3);
  const remaining = unique.length - shown.length;
  return remaining > 0 ? `${shown.join(", ")} e mais ${remaining}` : shown.join(", ");
}

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formador",
    "formacao_admin",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  let query = s
    .from("formacao_cohort_formadores")
    .select(
      "id, cohort_id, formador_user_id, percentual_honorario, created_at, formacao_cohorts:cohort_id(id, codigo, nome, curso_nome, data_inicio, data_fim, status, carga_horaria_total, vagas)"
    )
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (auth.role === "formador") {
    query = query.eq("formador_user_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const items = data ?? [];
  const cohortIds = Array.from(
    new Set(items.map((item) => String(item.cohort_id ?? "")).filter(Boolean))
  );

  if (cohortIds.length === 0) {
    return NextResponse.json({ ok: true, items });
  }

  const today = getTodayKey();
  let aulasQuery = s
    .from("formacao_aulas")
    .select("id, cohort_id, data, hora_inicio, hora_fim, status, conteudo_previsto, conteudo_realizado, horas_ministradas")
    .eq("escola_id", auth.escolaId)
    .in("cohort_id", cohortIds)
    .gte("data", today)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(50);

  let dueAulasQuery = s
    .from("formacao_aulas")
    .select("id, cohort_id, data, hora_inicio, hora_fim, status, conteudo_previsto, conteudo_realizado, horas_ministradas")
    .eq("escola_id", auth.escolaId)
    .in("cohort_id", cohortIds)
    .lte("data", today)
    .neq("status", "cancelada")
    .order("data", { ascending: false })
    .order("hora_inicio", { ascending: false })
    .limit(50);

  if (auth.role === "formador") {
    aulasQuery = aulasQuery.or(`formador_user_id.is.null,formador_user_id.eq.${auth.userId}`);
    dueAulasQuery = dueAulasQuery.or(`formador_user_id.is.null,formador_user_id.eq.${auth.userId}`);
  }

  const [
    { data: aulas },
    { data: dueAulas },
    { data: materiais },
    { data: inscricoes },
    { data: modulos },
    { data: progresso },
  ] = await Promise.all([
    aulasQuery,
    dueAulasQuery,
    s
      .from("formacao_materiais")
      .select("cohort_id")
      .eq("escola_id", auth.escolaId)
      .in("cohort_id", cohortIds),
    s
      .from("formacao_inscricoes")
      .select("id, cohort_id, estado, status_pagamento, nome_snapshot")
      .eq("escola_id", auth.escolaId)
      .in("cohort_id", cohortIds),
    s
      .from("formacao_cohort_modulos")
      .select("id, cohort_id")
      .eq("escola_id", auth.escolaId)
      .in("cohort_id", cohortIds),
    s
      .from("vw_formacao_estudante_progresso")
      .select("cohort_id, inscricao_id, percentual_presenca")
      .eq("escola_id", auth.escolaId)
      .in("cohort_id", cohortIds),
  ]);

  const activeInscricoes = ((inscricoes ?? []) as any[]).filter((item) =>
    ACTIVE_INSCRICAO_ESTADOS.has(String(item.estado ?? ""))
  );
  const inscricaoNames = new Map(
    activeInscricoes.map((item) => [
      String(item.id),
      String(item.nome_snapshot ?? "Formando(a)").trim() || "Formando(a)",
    ])
  );
  const inscricaoIds = activeInscricoes.map((item) => String(item.id)).filter(Boolean);
  const { data: avaliacoes } = inscricaoIds.length > 0
    ? await s
        .from("formacao_modulo_avaliacoes")
        .select("inscricao_id, modulo_id, nota, conceito")
        .eq("escola_id", auth.escolaId)
        .in("inscricao_id", inscricaoIds)
    : { data: [] as any[] };

  const aulasByCohort = new Map<string, any[]>();

  for (const aula of aulas ?? []) {
    const cohortId = String((aula as { cohort_id?: string | null }).cohort_id ?? "");
    if (!cohortId) continue;
    const current = aulasByCohort.get(cohortId) ?? [];
    current.push(aula);
    aulasByCohort.set(cohortId, current);
  }

  const dueAulaIds = ((dueAulas ?? []) as any[]).map((aula) => String(aula.id)).filter(Boolean);
  const { data: presencas } = dueAulaIds.length > 0
    ? await s
        .from("formacao_presencas")
        .select("aula_id")
        .eq("escola_id", auth.escolaId)
        .in("aula_id", dueAulaIds)
    : { data: [] as any[] };

  const presencaAulaIds = new Set((presencas ?? []).map((item: any) => String(item.aula_id)));
  const materialCohortIds = new Set((materiais ?? []).map((item: any) => String(item.cohort_id)));
  const avaliacaoKeys = new Set(
    ((avaliacoes ?? []) as any[]).map((item) => `${item.inscricao_id}:${item.modulo_id}`)
  );
  const modulosByCohort = new Map<string, any[]>();
  for (const modulo of (modulos ?? []) as any[]) {
    const cohortId = String(modulo.cohort_id ?? "");
    if (!cohortId) continue;
    const current = modulosByCohort.get(cohortId) ?? [];
    current.push(modulo);
    modulosByCohort.set(cohortId, current);
  }

  const activeCohortIds = new Set(
    items
      .filter((item: any) => isOperationalCohort(item.formacao_cohorts?.status))
      .map((item: any) => String(item.cohort_id))
  );
  const presencasPendentes = ((dueAulas ?? []) as any[]).filter((aula) => !presencaAulaIds.has(String(aula.id)));
  const sumariosPendentes = ((dueAulas ?? []) as any[]).filter(isSummaryOpen);
  const materiaisPendentes = Array.from(activeCohortIds).filter((cohortId) => !materialCohortIds.has(cohortId));
  let notasPendentesCount = 0;

  for (const inscricao of activeInscricoes) {
    const cohortModulos = modulosByCohort.get(String(inscricao.cohort_id)) ?? [];
    for (const modulo of cohortModulos) {
      if (!avaliacaoKeys.has(`${inscricao.id}:${modulo.id}`)) notasPendentesCount += 1;
    }
  }

  const notasBaixas = ((avaliacoes ?? []) as any[]).filter((avaliacao) => {
    const nota = Number(avaliacao.nota);
    return avaliacao.conceito === "nao_apto" || (Number.isFinite(nota) && nota < 10);
  });
  const baixaPresenca = ((progresso ?? []) as any[]).filter((item) => Number(item.percentual_presenca) < 75);
  const pagamentosBloqueantes = activeInscricoes.filter((item) =>
    ["pendente", "parcial"].includes(String(item.status_pagamento ?? ""))
  );
  const notasBaixasCount = notasBaixas.length;
  const baixaPresencaCount = baixaPresenca.length;
  const pagamentosBloqueantesCount = pagamentosBloqueantes.length;
  const aulasHoje = ((aulas ?? []) as any[]).filter((aula) => String(aula.data) === today);
  const proximasAulas = ((aulas ?? []) as any[]).slice(0, 5);

  const firstCohortId = String(items[0]?.cohort_id ?? "");
  const firstAulaHoje = aulasHoje[0] ?? proximasAulas[0] ?? null;
  const pendingAula = presencasPendentes[0] ?? sumariosPendentes[0] ?? firstAulaHoje;
  const tasks = [
    firstAulaHoje
      ? {
          id: "presenca-hoje",
          type: "presenca",
          label: "Lançar presença",
          description: "Abrir a chamada da aula de hoje.",
          href: `/formador/turma/${firstAulaHoje.cohort_id}?aula=${firstAulaHoje.id}&acao=presencas`,
          tone: "primary",
        }
      : null,
    pendingAula
      ? {
          id: "sumario-pendente",
          type: "sumario",
          label: "Registar sumário",
          description: "Fechar conteúdo e horas ministradas.",
          href: `/formador/turma/${pendingAula.cohort_id}?aula=${pendingAula.id}&acao=sumario`,
          tone: "neutral",
        }
      : null,
    firstCohortId
      ? {
          id: "material",
          type: "material",
          label: "Enviar material",
          description: "Adicionar ficheiro ou link de apoio.",
          href: `/formador/turma/${firstCohortId}?acao=material`,
          tone: materiaisPendentes.length > 0 ? "warning" : "neutral",
        }
      : null,
    firstCohortId
      ? {
          id: "aviso",
          type: "aviso",
          label: "Publicar aviso",
          description: "Enviar comunicação para a turma.",
          href: `/formador/turma/${firstCohortId}?acao=aviso`,
          tone: "neutral",
        }
      : null,
  ].filter(Boolean);

  const alerts = [
    baixaPresencaCount > 0
      ? {
          id: "baixa-presenca",
          type: "presenca",
          label: "Baixa presença",
          description: `${baixaPresencaCount} formando(s) abaixo de 75%: ${formatNameList(
            baixaPresenca.map((item) => inscricaoNames.get(String(item.inscricao_id)) ?? "Formando(a)")
          )}.`,
          severity: "high",
        }
      : null,
    notasBaixasCount > 0
      ? {
          id: "notas-baixas",
          type: "notas",
          label: "Notas críticas",
          description: `${notasBaixasCount} avaliação(ões) abaixo do mínimo: ${formatNameList(
            notasBaixas.map((item) => inscricaoNames.get(String(item.inscricao_id)) ?? "Formando(a)")
          )}.`,
          severity: "medium",
        }
      : null,
    pagamentosBloqueantesCount > 0
      ? {
          id: "pagamentos",
          type: "pagamentos",
          label: "Pagamentos pendentes",
          description: `${pagamentosBloqueantesCount} formando(s) com pagamento pendente/parcial: ${formatNameList(
            pagamentosBloqueantes.map((item) => inscricaoNames.get(String(item.id)) ?? "Formando(a)")
          )}.`,
          severity: "medium",
        }
      : null,
  ].filter(Boolean);

  const enrichedItems = items.map((item) => {
    const cohortAulas = aulasByCohort.get(String(item.cohort_id)) ?? [];
    const aulasHoje = cohortAulas.filter((aula) => String(aula.data) === today);
    return {
      ...item,
      aulas_hoje: aulasHoje,
      proxima_aula: cohortAulas[0] ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    items: enrichedItems,
    summary: {
      turmas_atribuidas: items.length,
      aulas_hoje: aulasHoje.length,
      proximas_aulas: proximasAulas,
      pendencias: {
        presencas: presencasPendentes.length,
        sumarios: sumariosPendentes.length,
        notas: notasPendentesCount,
        materiais: materiaisPendentes.length,
      },
      alertas: {
        baixa_presenca: baixaPresencaCount,
        notas_baixas: notasBaixasCount,
        pagamentos_bloqueantes: pagamentosBloqueantesCount,
      },
    },
    tasks,
    alerts,
  });
}
