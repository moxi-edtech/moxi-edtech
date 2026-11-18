import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const batch = read("../../src/components/secretaria/CurtumeFechoHistoricoLote.tsx");
const desk = read("../../src/components/secretaria/CurtumeHistoricalExceptionDesk.tsx");
const balc = read("../../src/app/secretaria/balcao/BalcaoPageClient.tsx");
const api = read("../../src/app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
const historical = read("../../src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
const historicalPage = read("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");

test("one-click case carries exact source enrollment and academic context into Balcão", () => {
  assert.match(batch, /historicMatriculaId: issue\.matricula_id/);
  assert.match(batch, /returnTo:/);
  assert.match(batch, /action: "reenrollment"/);
  assert.match(balc, /const historicMatriculaId = searchParams\?\.get\("historicMatriculaId"\)/);
  assert.match(balc, /selectedAlunoId && activeAction === "reenrollment"/);
  assert.match(balc, /escolaId === "3744879f-2e19-4671-8995-78604302d8c5"/);
  assert.match(balc, /<CurtumeHistoricalExceptionDesk/);
});

test("exception read requires authenticated 2025 tenant+student+matricula and still-open source", () => {
  assert.match(api, /const ctx = await context\(\)/);
  assert.match(api, /ROLES\.has\(String\(membership\?\.papel/);
  assert.match(api, /\.eq\("escola_id", CURTUME\)\.eq\("ano_letivo", 2025\)/);
  assert.match(api, /\.eq\("matricula_id", matriculaId\)\.eq\("aluno_id", alunoId\)/);
  assert.match(api, /\.eq\("snapshot_status", "aberto"\)/);
  assert.match(api, /origin\.session_id === history\.ano_letivo_id/);
  assert.match(api, /\.eq\("historico_ano_id", history\.id\)/);
  assert.match(api, /\.eq\("matricula_id", matriculaId\)/);
  assert.match(api, /operacionais\.length > 150/);
});

test("comparison is read-only; documentary ratification is a separate authenticated action", () => {
  assert.match(desk, /Pauta oficial · notas finais/);
  assert.match(desk, /Avaliações operacionais preservadas/);
  assert.match(desk, /Avaliações individuais não equivalem automaticamente à média final/);
  assert.match(desk, /Este painel não altera notas nem decisões automaticamente/);
  assert.match(desk, /method: "POST"/);
  assert.match(desk, /confirmacao: "CONFIRMO_PAUTA_2025"/);
  assert.match(api, /const GradeReconciliationSchema = z\.object/);
  assert.match(api, /notas_operacionais: operationalGrades/);
});

test("historical reconciliation opens exactly one enrollment, filtered before pagination", () => {
  assert.match(historical, /matricula_id: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(historical, /historiesQuery = historiesQuery\.eq\("matricula_id", parsed\.data\.matricula_id\)/);
  assert.match(historical, /\.range\(from, to\)/);
  assert.match(historicalPage, /focusMatriculaId/);
  assert.match(historicalPage, /query\.set\("matricula_id", focusMatriculaId\)/);
  assert.match(historicalPage, /focus\?\.matricula_id/);
  assert.match(historicalPage, /result\.items\.some\(\(item\) => item\.matricula_id === current\)/);
});
