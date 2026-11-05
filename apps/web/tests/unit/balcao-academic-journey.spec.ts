import test from "node:test";
import assert from "node:assert/strict";
import { nextBalcaoExamStep, nextBalcaoEjaStep, type BalcaoAcademicContext } from "../../src/lib/rematricula/balcao-academic-journey";
import { balcaoAcademicOperation } from "../../src/lib/rematricula/balcao-academic-operation";
const ctx = (): BalcaoAcademicContext => ({
  can_manage: true, ano_ativo: true, hoje_angola: "2026-11-05", source: { id: "m", turma_id: "t", status: "ativo", ativo: true },
  regime: { escala: "qualitativa", eh_classe_exame: false, exames_aplicaveis: [] },
  disciplinas: [{ id: "d", nome: "Português" }], turma_disciplinas: [{ id: "td", avaliacao_disciplina_id: "d" }],
  periodos: [], evidencias: [], frequencias: [], resultados: [],
  sessoes: [{ id: "s", tipo: "extraordinario", estado: "aberta", data_inicio: "2026-01-02", pendencias_publicacao: 0, participantes_pendentes: [], componentes: [{ id: "c1", codigo: "escrita", nota_max: 20 }, { id: "c2", codigo: "oral", nota_max: 20 }] }],
});
test("guide resumes each missing component, then validation, then publication", () => {
  const c = ctx();
  assert.equal(nextBalcaoExamStep(c, "", "d").action, "abrir_exame");
  assert.equal(nextBalcaoExamStep(c, "s", "d").componenteId, "c1");
  c.resultados.push({ id: "r1", nota: 12, exame_sessao_id: "s", exame_componente_id: "c1", turma_disciplina_id: "td", estado: "submetido" });
  assert.equal(nextBalcaoExamStep(c, "s", "d").componenteId, "c2");
  c.resultados.push({ ...c.resultados[0], id: "r2", exame_componente_id: "c2" });
  assert.equal(nextBalcaoExamStep(c, "s", "d").resultadoId, "r1");
  c.resultados[0].estado = "validado";
  assert.equal(nextBalcaoExamStep(c, "s", "d").resultadoId, "r2");
  c.resultados[1].estado = "validado";
  assert.equal(nextBalcaoExamStep(c, "s", "d").action, "publicar_exame");
  c.sessoes[0].pendencias_publicacao = 1;
  assert.equal(nextBalcaoExamStep(c, "s", "d").disabled, true);
});
test("guide never suggests a future examination or invents a curriculum link", () => {
  const c = ctx(); c.sessoes[0].data_inicio = "2027-01-02";
  assert.equal(nextBalcaoExamStep(c, "s", "d").disabled, true);
  c.sessoes[0].data_inicio = "2026-01-02";
  assert.equal(nextBalcaoExamStep(c, "s", "unknown").disabled, true);
});
test("EJA guide prioritizes missing evidence and missing periods, then points to documented insufficiency", () => {
  const c = ctx(); assert.equal(nextBalcaoEjaStep(c)?.disciplineId, "d");
  c.evidencias = [{ id: "e", disciplina_id: "d", suficiente: true }];
  c.frequencias = [1, 2, 3].map((n) => ({ periodo_id: String(n), numero: n, data_fim: "2026-10-31", aulas_previstas: null, presencas: null, evidence_id: null, documento_fonte: null, version: "v", pode_corrigir: true }));
  assert.equal(nextBalcaoEjaStep(c)?.periodId, "1");
  c.frequencias.forEach((f) => { f.aulas_previstas = 30; f.presencas = 30; });
  assert.equal(nextBalcaoEjaStep(c), null);
  c.frequencias[0].presencas = 0; // 60/90: sufficient; no unnecessary correction.
  assert.equal(nextBalcaoEjaStep(c), null);
  c.frequencias[1].presencas = 0;
  assert.equal(nextBalcaoEjaStep(c)?.action, "registar_frequencia_eja");
  c.frequencias[0].presencas = 30; c.frequencias[1].presencas = 30;
  c.evidencias[0].suficiente = false;
  assert.match(nextBalcaoEjaStep(c)?.title ?? "", /não suficiente/);
});
test("attendance writes require whole counts, official source and an exact context version", () => {
  const id = "60000000-0000-4000-8000-000000000001";
  const body = { acao: "registar_frequencia_eja", matricula_id: id, periodo_id: id, motivo: "Conferência do registo oficial de frequência", aulas_previstas: 30, presencas: 30, documento_fonte: "ATA-2026", expected_version: "a".repeat(32) };
  assert.equal(balcaoAcademicOperation.safeParse(body).success, true);
  for (const extra of [{ aulas_previstas: 0 }, { presencas: -1 }, { presencas: 2.5 }, { expected_version: "latest" }, { documento_fonte: "" }, { escola_id: id }, { registado_por: id }]) assert.equal(balcaoAcademicOperation.safeParse({ ...body, ...extra }).success, false);
});
