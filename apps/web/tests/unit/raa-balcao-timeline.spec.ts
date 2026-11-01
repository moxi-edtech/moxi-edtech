import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeRaaBalcaoTimeline } from "../../src/lib/rematricula/raa-balcao-timeline";

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
  const chrome = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  const balcao = source("components/secretaria/BalcaoAtendimento.tsx");
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const examContext = source("app/api/secretaria/balcao/raa/exam-context/route.ts");
  assert.match(status, /ano_letivo_id", matriculaOrigem\.session_id/);
  assert.match(status, /destino_matricula_id: matriculaDestino\?\.id/);
  assert.match(status, /academic_permissions: \{ can_write_grades:/);
  assert.match(chrome, /Origem:/);
  assert.match(chrome, /Destino:/);
  assert.match(balcao, /canLancarNota=\{rematriculaCanWriteGrades\}/);
  assert.match(panel, /examContext\.can_record_result/);
  assert.match(examContext, /can_record_result:/);
});
