import { instantiateAssistantActionV2, type AssistantActionV2 } from "../actions-v2";
import { hasAssistantPermission } from "../permission-registry";
import type { AiWidgetContext } from "../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";

type DataCopilotResponse = {
  ok: true;
  mode: "data_query";
  answer: string;
  actions?: AssistantActionV2[];
  links?: Array<{ label: string; href: string }>;
};

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

function isDebtByClassQuery(cleanQuery: string, context?: AiWidgetContext) {
  const isDebtQuery =
    cleanQuery.includes("em dívida") ||
    cleanQuery.includes("em divida") ||
    cleanQuery.includes("devedores") ||
    cleanQuery.includes("atraso") ||
    cleanQuery.includes("inadimpl");
  const hasClassScope = cleanQuery.includes("turma") || cleanQuery.includes("classe");

  return isDebtQuery && (hasClassScope || (context?.page === "turmas" && context?.entityId));
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

function formatDebtAnswer(params: {
  turmaNome: string;
  students: Array<{ nome: string; totalDebt: number }>;
}) {
  const { turmaNome, students } = params;
  const count = students.length;
  const total = students.reduce((sum, student) => sum + student.totalDebt, 0);

  let answer = `Na turma **${turmaNome}**, há atualmente **${count}** ${count === 1 ? "aluno" : "alunos"} com mensalidades em atraso.`;

  if (count === 0) {
    return `${answer} A saúde financeira desta turma está em dia.`;
  }

  answer += `\n\nO valor acumulado das dívidas nesta turma é de **${AOA_FORMATTER.format(total)}**.`;
  answer += "\n\n**Alunos devedores:**\n";

  students.slice(0, 5).forEach((student, index) => {
    answer += `${index + 1}. ${student.nome} (Débito: *${AOA_FORMATTER.format(student.totalDebt)}*)\n`;
  });

  if (count > 5) {
    answer += `\n*E mais ${count - 5} outros alunos...*`;
  }

  return answer;
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
  const answer = formatDebtAnswer({ turmaNome: matchingTurma.nome, students });
  const exportHref = `/api/secretaria/alunos/exportar?escolaId=${encodeURIComponent(schoolId)}&turma_id=${encodeURIComponent(matchingTurma.id)}&situacao_financeira=em_atraso&tipo=pdf`;

  const actions = students.length > 0
    ? [
        instantiateAssistantActionV2("finance:open_radar", role, { schoolId }),
        instantiateAssistantActionV2("finance:export_debtors_class", role, {
          schoolId,
          turmaId: matchingTurma.id,
        }),
        instantiateAssistantActionV2("finance:prepare_whatsapp_draft", role),
        instantiateAssistantActionV2("finance:save_billing_plan", role),
      ].filter((action): action is AssistantActionV2 => Boolean(action))
    : undefined;

  return {
    ok: true,
    mode: "data_query",
    answer,
    actions,
    links: students.length > 0
      ? [
          {
            label: "Baixar PDF de Inadimplentes da Turma",
            href: exportHref,
          },
        ]
      : undefined,
  };
}
