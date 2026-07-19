import { instantiateAssistantActionV2, type AssistantActionV2 } from "../actions-v2";
import { hasAssistantPermission } from "../permission-registry";
import type { AiWidgetContext } from "../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "./answer-composer";
import type { DataCopilotResponse, DataCopilotTool } from "./types";

type TurmaRow = {
  id: string;
  nome: string | null;
  turma_codigo: string | null;
};

type RadarDebtRow = {
  aluno_id: string | null;
  nome_aluno: string | null;
  nome_turma: string | null;
  valor_em_atraso: number | string | null;
};

const AOA_FORMATTER = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

export function isDebtByClassQuery(cleanQuery: string, context?: AiWidgetContext) {
  const isDebtQuery =
    cleanQuery.includes("em dívida") ||
    cleanQuery.includes("em divida") ||
    cleanQuery.includes("devedores") ||
    cleanQuery.includes("atraso") ||
    cleanQuery.includes("inadimpl");
  const hasClassScope = cleanQuery.includes("turma") || cleanQuery.includes("classe");

  return isDebtQuery && (hasClassScope || Boolean(context?.page === "turmas" && context.entityId));
}

function findMatchingTurma(turmas: TurmaRow[], cleanQuery: string, context?: AiWidgetContext) {
  const byQuery = turmas.find((turma) => {
    const name = (turma.nome ?? "").toLowerCase().trim();
    const code = (turma.turma_codigo ?? "").toLowerCase().trim();
    return name && (cleanQuery.includes(name) || (code && cleanQuery.includes(code)));
  });

  if (byQuery) return byQuery;

  if (context?.entityType === "class" && context.entityId) {
    return turmas.find((turma) => turma.id === context.entityId);
  }

  return undefined;
}

export async function answerFinanceDebtByClass(params: {
  schoolId: string;
  role: string;
  query: string;
  context?: AiWidgetContext;
}): Promise<DataCopilotResponse | null> {
  const { schoolId, role, query, context } = params;
  const cleanQuery = query.trim().toLowerCase();

  if (!isDebtByClassQuery(cleanQuery, context)) {
    return null;
  }

  if (!hasAssistantPermission(role, "assistant.finance")) {
    return null;
  }

  const supabase = await supabaseServerTyped();
  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, turma_codigo")
    .eq("escola_id", schoolId);

  const matchingTurma = findMatchingTurma((turmas ?? []) as TurmaRow[], cleanQuery, context);
  if (!matchingTurma?.id || !matchingTurma.nome) {
    return null;
  }

  const { data: radarRows } = await supabase
    .from("vw_radar_inadimplencia")
    .select("aluno_id, nome_aluno, nome_turma, valor_em_atraso")
    .eq("escola_id", schoolId)
    .ilike("nome_turma", matchingTurma.nome);

  const uniqueStudents = new Map<string, { nome: string; totalDebt: number }>();

  for (const row of (radarRows ?? []) as RadarDebtRow[]) {
    if (!row.aluno_id || !row.nome_aluno) continue;

    const current = uniqueStudents.get(row.aluno_id);
    const totalDebt = Number(row.valor_em_atraso ?? 0);

    uniqueStudents.set(row.aluno_id, {
      nome: row.nome_aluno,
      totalDebt: (current?.totalDebt ?? 0) + totalDebt,
    });
  }

  const students = Array.from(uniqueStudents.values());
  const total = students.reduce((sum, student) => sum + student.totalDebt, 0);
  const exportHref = `/api/secretaria/alunos/exportar?escolaId=${encodeURIComponent(schoolId)}&turma_id=${encodeURIComponent(matchingTurma.id)}&situacao_financeira=em_atraso&tipo=pdf`;

  const actions: AssistantActionV2[] = students.length > 0
    ? [
        instantiateAssistantActionV2("finance:open_radar", role, { schoolId }),
        instantiateAssistantActionV2("finance:export_debtors_class", role, {
          schoolId,
          turmaId: matchingTurma.id,
        }),
        instantiateAssistantActionV2("finance:prepare_whatsapp_draft", role),
        instantiateAssistantActionV2("finance:save_billing_plan", role),
      ].filter((action): action is AssistantActionV2 => Boolean(action))
    : [];

  return createDataCopilotResponse({
    insight: {
      diagnosis: students.length === 0
        ? `A turma **${matchingTurma.nome}** não tem alunos com mensalidades em atraso.`
        : `A turma **${matchingTurma.nome}** tem **${students.length}** ${students.length === 1 ? "aluno" : "alunos"} em atraso, somando **${AOA_FORMATTER.format(total)}**.`,
      impact: students.length === 0
        ? "Não há risco financeiro vencido identificado nesta turma neste momento."
        : "A dívida vencida desta turma exige acompanhamento para reduzir o risco de acumulação e perda de receita.",
      recommendation: students.length === 0
        ? "Manter a monitorização no Radar Financeiro."
        : "Rever a lista de devedores e preparar uma cobrança segmentada para aprovação humana.",
      evidence: [
        { label: "Turma", value: matchingTurma.nome },
        { label: "Alunos em atraso", value: String(students.length) },
        { label: "Valor em atraso", value: AOA_FORMATTER.format(total) },
      ],
      actions,
    },
    links: students.length > 0
      ? [
          {
            label: "Baixar PDF de Inadimplentes da Turma",
            href: exportHref,
          },
        ]
      : undefined,
  });
}

export const financeDebtByClassTool: DataCopilotTool = {
  id: "finance-debt-by-class",
  module: "financeiro",
  requiredPermission: "assistant.finance",
  match: isDebtByClassQuery,
  run: answerFinanceDebtByClass,
};
