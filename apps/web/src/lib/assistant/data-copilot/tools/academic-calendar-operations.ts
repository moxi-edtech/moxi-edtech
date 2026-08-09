import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentTerms, normalizeAssistantText } from "../query-matcher";
import type { DataCopilotTool } from "../types";

type AcademicYearRow = {
  id: string;
  ano: number | string | null;
  data_inicio: string | null;
  data_fim: string | null;
};

type PeriodRow = {
  tipo: string | null;
  numero: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

type CalendarEventRow = {
  nome: string | null;
  tipo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
};

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "data não definida";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function isAcademicCalendarQuery(query: string, context?: AiWidgetContext) {
  const normalized = normalizeAssistantText(query);
  const calendarTerms = matchesIntentTerms(
    normalized,
    ["calendario", "periodo", "fase", "med", "trimestre", "exame", "conselho", "pauta", "prazo"],
    { maxDistance: 2 },
  );
  const operationalTerms = matchesIntentTerms(
    normalized,
    ["hoje", "proximo", "seguinte", "quando", "atencao", "tarefa", "operacao", "escola"],
    { maxDistance: 2 },
  );
  return context?.module === "academico" || (calendarTerms && operationalTerms);
}

export const academicCalendarOperationsTool: DataCopilotTool = {
  id: "academic-calendar-operations",
  module: "academico",
  requiredPermission: "assistant.academico",
  match: isAcademicCalendarQuery,
  async run({ schoolId, role }) {
    return runAcademicCalendarOperations({
      schoolId,
      role,
      supabase: await supabaseServerTyped(),
    });
  },
};

export async function runAcademicCalendarOperations({
  schoolId,
  role,
  supabase,
}: {
  schoolId: string;
  role: string;
  supabase: any;
}) {
    const today = localDateKey();
    const horizon = addDays(today, 45);

    const { data: years, error: yearsError } = await supabase
      .from("anos_letivos")
      .select("id, ano, data_inicio, data_fim")
      .eq("escola_id", schoolId)
      .eq("ativo", true)
      .order("data_inicio", { ascending: false })
      .limit(1);
    if (yearsError) throw yearsError;

    const year = (years?.[0] ?? null) as AcademicYearRow | null;
    if (!year) {
      return createDataCopilotResponse({
        insight: {
          severity: "high",
          diagnosis: "Não existe um ano letivo activo configurado para esta escola.",
          impact: "Sem ano letivo e calendário vinculados, o sistema não consegue gerar tarefas académicas confiáveis.",
          recommendation: "Configurar ou activar o ano letivo e aplicar o calendário escolar antes de iniciar a operação.",
          evidence: [{ label: "Ano letivo activo", value: "Não configurado" }],
          actions: [],
        },
      });
    }

    const [{ data: periods, error: periodsError }, { data: events, error: eventsError }] = await Promise.all([
      supabase
        .from("periodos_letivos")
        .select("tipo, numero, data_inicio, data_fim")
        .eq("escola_id", schoolId)
        .eq("ano_letivo_id", year.id)
        .order("data_inicio", { ascending: true }),
      supabase
        .from("calendario_eventos")
        .select("nome, tipo, data_inicio, data_fim")
        .eq("escola_id", schoolId)
        .eq("ano_letivo_id", year.id)
        .gte("data_inicio", today)
        .lte("data_inicio", horizon)
        .order("data_inicio", { ascending: true })
        .order("nome", { ascending: true })
        .limit(20),
    ]);
    if (periodsError) throw periodsError;
    if (eventsError) throw eventsError;

    const periodRows = (periods ?? []) as PeriodRow[];
    const eventRows = (events ?? []) as CalendarEventRow[];
    const currentPeriod = periodRows.find((period) =>
      period.data_inicio && period.data_fim && today >= period.data_inicio && today <= period.data_fim,
    );
    const nextEvent = eventRows[0] ?? null;
    const beforeYear = Boolean(year.data_inicio && today < year.data_inicio);
    const afterYear = Boolean(year.data_fim && today > year.data_fim);
    const phase = beforeYear ? "Pré-início" : afterYear ? "Encerrado" : "Aulas";
    const gradesAction = instantiateAssistantActionV2("academico:open_grades", role, { schoolId });
    const calendarAction = instantiateAssistantActionV2("academico:open_calendar", role, { schoolId });
    const councilAction = instantiateAssistantActionV2("academico:open_council", role, { schoolId });
    const actions = [calendarAction, gradesAction, councilAction].filter((action): action is AssistantActionV2 => Boolean(action));

    const nextEventText = nextEvent
      ? `O próximo marco é **${nextEvent.nome ?? nextEvent.tipo ?? "evento académico"}**, em ${formatDate(nextEvent.data_inicio)}.`
      : "Não há eventos do calendário nos próximos 45 dias.";
    const periodText = currentPeriod
      ? `${currentPeriod.tipo ?? "Período"} ${currentPeriod.numero ?? ""}`.trim()
      : "fora de um período letivo";

    return createDataCopilotResponse({
      insight: {
        severity: beforeYear || afterYear ? "medium" : nextEvent ? "low" : "info",
        diagnosis: `O ano letivo **${year.ano ?? "—"}/${year.ano ? Number(year.ano) + 1 : "—"}** decorre de ${formatDate(year.data_inicio)} a ${formatDate(year.data_fim)}. Hoje a escola está em **${phase}**, ${periodText}.`,
        impact: nextEventText,
        recommendation: beforeYear
          ? "Preparar turmas, horários, matrículas e responsáveis antes da abertura oficial das aulas."
          : afterYear
            ? "Fechar o ciclo, validar pautas e preparar o próximo ano letivo."
            : nextEvent
              ? "Usar o próximo marco como prazo operacional: confirmar responsáveis, lançar notas quando aplicável e validar a pauta antes do conselho."
              : "Manter o calendário publicado e rever as pendências académicas do período actual.",
        evidence: [
          { label: "Ano letivo", value: `${year.ano ?? "—"}/${year.ano ? Number(year.ano) + 1 : "—"}` },
          { label: "Intervalo oficial", value: `${formatDate(year.data_inicio)} — ${formatDate(year.data_fim)}` },
          { label: "Fase", value: phase },
          { label: "Período actual", value: periodText },
          { label: "Próximo marco", value: nextEvent ? `${nextEvent.nome ?? nextEvent.tipo ?? "Evento"} · ${formatDate(nextEvent.data_inicio)}` : "Nenhum em 45 dias" },
        ],
        actions,
      },
    });
}
