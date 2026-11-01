import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectApplicableCalendarRecords, selectApplicablePeriods, summarizeRaaBalcaoTimeline } from "../../src/lib/rematricula/raa-balcao-timeline";

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
  assert.match(upcoming.proximaEtapa, /20\\/05\\/2027/);
});

test("overlapping official trimesters never show an invented active trimester", () => {
  const overlap = summarizeRaaBalcaoTimeline({
    ...base, hoje: "2027-05-15",
    periodos: [...periodos, { id: "duplicate", tipo: "TRIMESTRE", numero: 2, data_inicio: "2027-05-01", data_fim: "2027-05-30" }],
  });
  assert.equal(overlap.fase, "desconhecida");
  assert.match(overlap.proximaEtapa, /Confirmar as datas/);
});
