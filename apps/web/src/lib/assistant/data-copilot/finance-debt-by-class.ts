import { instantiateAssistantActionV2, type AssistantActionV2 } from "../actions-v2";
import { hasAssistantPermission } from "../permission-registry";
import type { AiWidgetContext } from "../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "./answer-composer";
import { matchesIntentQuery } from "./query-matcher";
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

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  klasse: "classe",
  primeira: "1",
  primeiro: "1",
  segunda: "2",
  segundo: "2",
  terceira: "3",
  terceiro: "3",
  quarta: "4",
  quarto: "4",
  quinta: "5",
  quinto: "5",
  sexta: "6",
  sexto: "6",
  setima: "7",
  setimo: "7",
  oitava: "8",
  oitavo: "8",
  nona: "9",
  nono: "9",
  decima: "10",
  decimo: "10",
  undecima: "11",
  undecimo: "11",
  "decima-primeira": "11",
  "decimo-primeiro": "11",
  duodecima: "12",
  duodecimo: "12",
  "decima-segunda": "12",
  "decimo-segundo": "12",
  "decima-terceira": "13",
  "decimo-terceiro": "13",
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ªº°]/g, "")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((token) => NUMBER_WORDS[token] ?? token)
    .join(" ");
}

export function isDebtByClassQuery(cleanQuery: string, context?: AiWidgetContext) {
  return matchesIntentQuery({
    query: cleanQuery,
    scopeTerms: ["divida", "devedor", "atraso", "inadimpl"],
    diagnosisTerms: ["turma", "classe"],
    contextMatches: context?.page === "turmas" && Boolean(context.entityId),
    options: { maxDistance: 2 },
  });
}

function extractClassNumber(value: string) {
  const normalized = normalizeText(value);
  const classMatch = normalized.match(/\b(\d{1,2})\s*(?:a\s+)?classe\b/);
  if (classMatch?.[1]) return classMatch[1];

  return normalized.match(/\b(\d{1,2})\b/)?.[1];
}

function extractSection(value: string, classNumber?: string) {
  if (!classNumber) return undefined;

  const normalized = normalizeText(value);
  return normalized.match(new RegExp(`\\b${classNumber}\\s+(?:classe\\s+)?([a-z])\\b`))?.[1];
}

function extractProgramPrefix(value: string, classNumber?: string) {
  if (!classNumber) return undefined;

  const normalized = normalizeText(value);
  return normalized.match(new RegExp(`\\b([a-z]{2,})[- ]*${classNumber}\\b`))?.[1];
}

function findMatchingTurmas(turmas: TurmaRow[], cleanQuery: string, context?: AiWidgetContext) {
  const normalizedQuery = normalizeText(cleanQuery);
  const exactMatches = turmas.filter((turma) => {
    const name = normalizeText(turma.nome ?? "");
    const code = normalizeText(turma.turma_codigo ?? "");
    return Boolean(
      (name && normalizedQuery.includes(name)) ||
      (code && normalizedQuery.includes(code)),
    );
  });

  if (exactMatches.length > 0) return exactMatches;

  if (context?.entityType === "class" && context.entityId) {
    const contextualTurma = turmas.find((turma) => turma.id === context.entityId);
    if (contextualTurma) return [contextualTurma];
  }

  const queryClassNumber = extractClassNumber(normalizedQuery);
  if (!queryClassNumber) return [];

  const querySection = extractSection(normalizedQuery, queryClassNumber);
  const queryProgramPrefix = extractProgramPrefix(normalizedQuery, queryClassNumber);
  return turmas.filter((turma) => {
    const searchableName = `${turma.nome ?? ""} ${turma.turma_codigo ?? ""}`;
    if (extractClassNumber(searchableName) !== queryClassNumber) return false;
    if (
      queryProgramPrefix &&
      extractProgramPrefix(searchableName, queryClassNumber) !== queryProgramPrefix
    ) {
      return false;
    }
    if (!querySection) return true;

    return extractSection(searchableName, queryClassNumber) === querySection;
  });
}

function createTurmaResolutionResponse(params: {
  diagnosis: string;
  recommendation: string;
  evidence?: Array<{ label: string; value: string }>;
}) {
  return createDataCopilotResponse({
    insight: {
      diagnosis: params.diagnosis,
      impact: "A intenção financeira foi reconhecida, mas a turma precisa de ser identificada antes da consulta.",
      recommendation: params.recommendation,
      evidence: params.evidence ?? [],
      actions: [],
    },
  });
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
  const { data: turmas, error: turmasError } = await supabase
    .from("turmas")
    .select("id, nome, turma_codigo")
    .eq("escola_id", schoolId);

  if (turmasError) {
    return createTurmaResolutionResponse({
      diagnosis: "Não foi possível consultar as turmas neste momento.",
      recommendation: "Tente novamente dentro de instantes ou abra o Radar Financeiro.",
    });
  }

  const availableTurmas = (turmas ?? []) as TurmaRow[];
  const matchingTurmas = findMatchingTurmas(availableTurmas, cleanQuery, context);

  if (matchingTurmas.length === 0) {
    const availableNames = availableTurmas
      .map((turma) => turma.nome)
      .filter((name): name is string => Boolean(name))
      .slice(0, 6);

    return createTurmaResolutionResponse({
      diagnosis: "Não encontrei uma turma correspondente à classe indicada.",
      recommendation: availableNames.length > 0
        ? `Indique uma destas turmas: ${availableNames.join(", ")}.`
        : "Confirme se a turma está cadastrada e tente novamente.",
      evidence: availableNames.length > 0
        ? [{ label: "Turmas disponíveis", value: availableNames.join(", ") }]
        : [],
    });
  }

  if (matchingTurmas.length > 1) {
    const matchingNames = matchingTurmas
      .map((turma) => turma.nome)
      .filter((name): name is string => Boolean(name));

    return createTurmaResolutionResponse({
      diagnosis: `Encontrei **${matchingNames.length} turmas** para essa classe.`,
      recommendation: `Indique a turma exacta: ${matchingNames.join(", ")}.`,
      evidence: [{ label: "Turmas encontradas", value: matchingNames.join(", ") }],
    });
  }

  const [matchingTurma] = matchingTurmas;
  if (!matchingTurma?.id || !matchingTurma.nome) {
    return createTurmaResolutionResponse({
      diagnosis: "A turma encontrada não possui identificação completa.",
      recommendation: "Corrija o cadastro da turma antes de consultar a inadimplência.",
    });
  }

  const { data: radarRows, error: radarError } = await supabase
    .from("vw_radar_inadimplencia")
    .select("aluno_id, nome_aluno, nome_turma, valor_em_atraso")
    .eq("escola_id", schoolId)
    .ilike("nome_turma", matchingTurma.nome);

  if (radarError) {
    return createTurmaResolutionResponse({
      diagnosis: `Não foi possível consultar a inadimplência da turma **${matchingTurma.nome}** neste momento.`,
      recommendation: "Tente novamente dentro de instantes ou abra o Radar Financeiro.",
      evidence: [{ label: "Turma", value: matchingTurma.nome }],
    });
  }

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
