import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectApplicableCalendarRecords, selectApplicablePeriods, summarizeRaaBalcaoTimeline } from "../../src/lib/rematricula/raa-balcao-timeline";
import { nextAcademicActionForBalcao } from "../../src/lib/rematricula/raa-balcao-next-action";

const periodos = [
  { id: "p1", tipo: "TRIMESTRE", numero: 1, data_inicio: "2026-09-01", data_fim: "2026-11-30" },
  { id: "p2", tipo: "TRIMESTRE", numero: 2, data_inicio: "2027-01-05", data_fim: "2027-03-31" },
  { id: "p3", tipo: "TRIMESTRE", numero: 3, data_inicio: "2027-04-07", data_fim: "2027-07-10" },
];
const base = {
  periodos,
  eventos: [
    { tipo: "PROVA_TRIMESTRAL", data_inicio: "2027-06-20", data_fim: "2027-06-25" },
  ],
  sessoes: [],
  resultados: [],
  pautas: [],
};
test("first and second trimester never become a final decision", () => {
  const first = summarizeRaaBalcaoTimeline({ ...base, hoje: "2026-10-01" });
  const second = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-02-01" });
  assert.equal(first.fase, "primeiro");
  assert.match(first.proximaEtapa, /2.º trimestre/);
  assert.equal(second.fase, "segundo");
  assert.match(second.proximaEtapa, /3.º trimestre/);
  assert.equal(first.pautaFinalPublicada, false);
  assert.equal(second.pautaFinalPublicada, false);
});
test("third trimester distinguishes scheduled and current exam windows", () => {
  const scheduled = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-05-15" });
  const inExam = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-06-22" });
  assert.equal(scheduled.fase, "terceiro");
  assert.equal(scheduled.provas, "agendadas");
  assert.equal(inExam.provas, "em_curso");
});
test("past scheduled dates do not constitute proof of a completed exam", () => {
  const ended = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-08-01" });
  assert.equal(ended.fase, "apos_fim");
  assert.equal(ended.provas, "datas_decorridas");
  assert.equal(ended.exames, "sem_sessao");
  assert.equal(ended.pautaFinalPublicada, false);
});
test("only successful published third-trimester PDF counts as final pauta", () => {
  const wrongPeriod = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-08-01",
    pautas: [{ status: "SUCCESS", pdf_path: "pauta.pdf", periodo_letivo_id: "p2" }],
  });
  const draft = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-08-01",
    pautas: [{ status: "PROCESSING", pdf_path: "pauta.pdf", periodo_letivo_id: "p3" }],
  });
  const published = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-08-01",
    pautas: [{ status: "SUCCESS", pdf_path: "pauta.pdf", periodo_letivo_id: "p3" }],
  });
  assert.equal(wrongPeriod.pautaFinalPublicada, false);
  assert.equal(draft.pautaFinalPublicada, false);
  assert.equal(published.pautaFinalPublicada, true);
});
test("exam grade evidence is distinct from a published official pauta", () => {
  const result = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-08-01",
    sessoes: [{ id: "exam1", estado: "publicada", data_inicio: "2027-07-12", data_fim: "2027-07-12" }],
    resultados: [{ exame_sessao_id: "exam1", nota: 14, estado: "submetido" }],
    pedidosReapreciacao: 1,
  });
  assert.equal(result.exames, "com_notas");
  assert.equal(result.notasExameRegistadas, 1);
  assert.equal(result.pautaFinalPublicada, false);
  assert.equal(result.pedidosReapreciacao, 1);
});
test("missing official periods never invent a trimester", () => {
  const result = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-02-01", periodos: [] });
  assert.equal(result.fase, "desconhecida");
});
test("status endpoint and UI use source-year data and restrict write actions", () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const timelineServer = source("lib/rematricula/raa-balcao-timeline-server.ts");
  const chrome = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  const writer = source("app/api/secretaria/balcao/rematriculas/route.ts");
  const resultWriter = source("app/api/academico/exames/resultados/route.ts");
  const balcao = source("components/secretaria/BalcaoAtendimento.tsx");
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const examContext = source("app/api/secretaria/balcao/raa/exam-context/route.ts");
  assert.match(timelineServer, /ano_letivo_id", matriculaOrigem\.session_id/);
  assert.match(status, /loadRaaBalcaoAcademicTimeline/);
  assert.match(status, /include_academic_timeline/);
  assert.match(status, /DESTINATION_ENROLLED/);
  assert.match(status, /academic_timeline_ano_letivo_ano/);
  assert.match(status, /destino_matricula_id: matriculaDestino\?\.id/);
  assert.match(status, /academic_permissions: \{ can_write_grades:/);
  assert.match(chrome, /Origem:/);
  assert.match(chrome, /Destino:/);
  assert.match(balcao, /canLancarNota=\{rematriculaCanWriteGrades\}/);
  assert.match(panel, /examContext\.can_record_result/);
  assert.match(examContext, /can_record_result:/);
  assert.match(resultWriter, /EXAM_NOT_STARTED/);
  assert.match(writer, /REMATRICULA_TARGET_ALREADY_ENROLLED/);
});

test("specific offering trimester overrides only the matching school-wide trimester", () => {
  const mixed = [
    { id: "g1", tipo: "TRIMESTRE", numero: 1, data_inicio: "2026-09-01", data_fim: "2026-11-30", offering_id: null },
    { id: "g2", tipo: "TRIMESTRE", numero: 2, data_inicio: "2027-01-05", data_fim: "2027-03-31", offering_id: null },
    { id: "a1", tipo: "TRIMESTRE", numero: 1, data_inicio: "2026-10-01", data_fim: "2026-12-10", offering_id: "offer-a" },
    { id: "b1", tipo: "TRIMESTRE", numero: 1, data_inicio: "2026-08-01", data_fim: "2026-11-15", offering_id: "offer-b" },
  ];
  assert.deepEqual(selectApplicablePeriods(mixed, "offer-a").map((p) => p.id), ["g2", "a1"]);
  assert.deepEqual(selectApplicablePeriods(mixed, null).map((p) => p.id), ["g1", "g2"]);
});

test("shared events remain visible with specific events; other offerings do not leak", () => {
  const events = [
    { offering_id: null, tipo: "PROVA_TRIMESTRAL" },
    { offering_id: "offer-a", tipo: "EXAME_ORAL" },
    { offering_id: "offer-b", tipo: "EXAME_ESCRITO" },
  ];
  assert.deepEqual(selectApplicableCalendarRecords(events, "offer-a").map((e) => e.tipo),
    ["PROVA_TRIMESTRAL", "EXAME_ORAL"]);
});

test("next step uses the earliest upcoming official date, not a generic trimester label", () => {
  const upcoming = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-05-15",
    eventos: [
      { tipo: "PROVA_TRIMESTRAL", data_inicio: "2027-05-20", data_fim: "2027-05-22" },
      { tipo: "PROVA_TRIMESTRAL", data_inicio: "2027-06-20", data_fim: "2027-06-25" },
    ],
  });
  assert.ok(upcoming.proximaEtapa.includes("20/05/2027"));
});

test("scheduled publication never masquerades as an already published final pauta", () => {
  const result = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-07-14",
    eventos: [{ tipo: "PUBLICACAO_PAUTA", data_inicio: "2027-07-16", data_fim: "2027-07-16" }],
  });
  assert.equal(result.pautaFinalPublicada, false);
  assert.match(result.proximaEtapa, /Publicação da pauta prevista/);
  assert.ok(result.proximaEtapa.includes("16/07/2027"));
});

test("overlapping official trimesters never show an invented active trimester", () => {
  const overlap = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-05-15",
    periodos: [...periodos, { id: "duplicate", tipo: "TRIMESTRE", numero: 2, data_inicio: "2027-05-01", data_fim: "2027-05-30" }],
  });
  assert.equal(overlap.fase, "desconhecida");
  assert.match(overlap.proximaEtapa, /Confirmar as datas/);
});

test("canonical event is displayed once; independent school event stays visible", () => {
  const records = [
    { tipo: "PROVA_TRIMESTRAL", nome: "I trimestre", source_item_id: "item-1", offering_id: null, data_inicio: "2026-11-04", data_fim: "2026-11-10" },
    { tipo: "PROVA_TRIMESTRAL", nome: "I trimestre", source_item_id: "item-1", offering_id: "offer-a", data_inicio: "2026-12-09", data_fim: "2026-12-18" },
    { tipo: "EXAME_ORAL", nome: "Avaliação geral", source_item_id: "item-2", offering_id: null, data_inicio: "2027-06-01", data_fim: "2027-06-03" },
    { tipo: "EXAME_ESCRITO", nome: "Outra oferta", source_item_id: "item-3", offering_id: "offer-b", data_inicio: "2027-05-01", data_fim: "2027-05-02" },
  ];
  const selected = selectApplicableCalendarRecords(records, "offer-a");
  assert.equal(selected.length, 2);
  assert.equal(selected[0].data_inicio, "2026-12-09");
  assert.equal(selected[1].nome, "Avaliação geral");
  const general = selectApplicableCalendarRecords(records, null);
  assert.equal(general.length, 2);
  assert.equal(general[0].data_inicio, "2026-11-04");
});

test("legacy duplicates collapse only when name, dates and type all match", () => {
  const records = [
    { tipo: "PROVA_TRIMESTRAL", nome: "Provas I", offering_id: null, data_inicio: "2026-12-09", data_fim: "2026-12-18" },
    { tipo: "PROVA_TRIMESTRAL", nome: "Provas I", offering_id: "offer-a", data_inicio: "2026-12-09", data_fim: "2026-12-18" },
    { tipo: "PROVA_TRIMESTRAL", nome: "Provas II", offering_id: "offer-a", data_inicio: "2027-04-01", data_fim: "2027-04-09" },
  ];
  assert.deepEqual(selectApplicableCalendarRecords(records, "offer-a").map((v) => v.nome), ["Provas I", "Provas II"]);
});

test("next action follows the official date only when academic decision is pending", () => {
  const timeline = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-05-15",
    eventos: [{ tipo: "PROVA_TRIMESTRAL", data_inicio: "2027-05-20", data_fim: "2027-05-22" }],
  });
  const pending = nextAcademicActionForBalcao("ACADEMIC_PENDING", timeline);
  assert.equal(pending.title, "Ano em curso");
  assert.ok(pending.message?.includes("20/05/2027"));
  assert.ok(pending.message?.includes("decisão final"));
  assert.deepEqual(nextAcademicActionForBalcao("READY", timeline), { title: null, message: null });
  assert.deepEqual(nextAcademicActionForBalcao("WINDOW_CLOSED", timeline), { title: null, message: null });
});

test("published pauta triggers verification, while unknown period asks to check dates", () => {
  const published = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-07-17",
    pautas: [{ status: "SUCCESS", pdf_path: "final.pdf", periodo_letivo_id: "p3" }],
  });
  const unknown = summarizeRaaBalcaoTimeline({ ...base, hoje: "2027-07-17", periodos: [] });
  assert.match(nextAcademicActionForBalcao("ACADEMIC_PENDING", published).message ?? "", /Pauta publicada/);
  assert.equal(nextAcademicActionForBalcao("ACADEMIC_PENDING", unknown).title, "Calendário por confirmar");
});
