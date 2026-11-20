import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../../src/components/academico/CalendarioAvaliacoesClient.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../src/app/api/escola/[id]/calendario-avaliacoes/route.ts", import.meta.url), "utf8");

test("não reusa um único horário para todas as disciplinas: cada linha tem estado próprio", () => {
  assert.match(client, /schedule\[s\.id\]\?\.data/);
  assert.match(client, /schedule\[s\.id\]\?\.inicio/);
  assert.match(client, /schedule\[s\.id\]\?\.fim/);
  assert.match(client, /updateSchedule\(subject\.id, "data"/);
  assert.match(client, /updateSchedule\(subject\.id, "inicio"/);
  assert.match(client, /updateSchedule\(subject\.id, "fim"/);
  assert.match(client, /!ready/);
  assert.doesNotMatch(client, /selected\.map\(\(s\) => \(\{[\s\S]*?tipo: kind, data: date, inicio: start/);
});

test("pesquisa apenas turmas do endpoint ativo e oferece seleção visível de disciplinas", () => {
  assert.match(client, /data\.turmas\.map/);
  assert.match(client, /classSearch/);
  assert.match(client, /setClassIds\(e\.target\.value \? \[e\.target\.value\] : \[\]\)/);
  assert.match(client, /setChosen\(\[\]\); setSchedule\(\{\}\)/);
  assert.match(client, /Selecionar visíveis/);
  assert.match(client, /Limpar visíveis/);
  assert.match(client, /setChosen\(\(current\) => current\.filter/);
});

test("conflitos são visíveis antes de guardar; base continua a validar corridas", () => {
  assert.match(client, /assessmentPlanOverlaps\(rows as AssessmentScheduleSlot\[\], data\?\.items/);
  assert.match(client, /Conflito com /);
  assert.match(client, /role="alert"/);
  assert.match(client, /ready = rows\.length > 0/);
  assert.match(backend, /result\.error\.code === "23P01"/);
  assert.match(backend, /action: z\.literal\("create"\)/);
});

test("publicação continua explícita, apenas rascunhos selecionados e auditada", () => {
  assert.match(client, /selectedDrafts\.map\(\(i\) => i\.id\)/);
  assert.match(client, /window\.confirm\("Publicar apenas as "/);
  assert.match(client, /id="avaliacoes-agenda"/);
  assert.match(client, /Publicar selecionadas/);
  assert.match(backend, /db\.rpc\("publicar_calendario_avaliacoes"/);
});

test("edição utiliza a data do formulário e não o objeto de dados carregados", () => {
  assert.match(client, /id: editing, turma_id: current\.turma_id, data: date, inicio: start/);
  assert.match(client, /action: "edit", id: editing, tipo: kind, data: date, inicio: start/);
});

test("após guardar rascunhos abre lista da turma, sem esconder datas fora da semana", () => {
  assert.match(client, /setMode\("lista"\); setClassFilter\(rows\[0\]\?\.turma_id \?\? ""\)/);
  assert.match(client, /setAgendaSearch\(""\); setSelectedIds\(\[\]\)/);
});

test("campos obrigatórios em falta são indicados na própria linha", () => {
  assert.match(client, /const missing = warnings\.filter/);
  assert.match(client, /missing\.join\(" "\)/);
  assert.match(client, /Defina a data\./);
  assert.match(client, /Defina a hora de início\./);
});
