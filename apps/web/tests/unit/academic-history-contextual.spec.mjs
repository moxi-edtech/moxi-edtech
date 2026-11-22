import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const src = (file) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

test("AppShell não renderiza seletor universal nem herda ano da sidebar", () => {
  const shell = src("components/layout/klasse/AppShell.tsx");
  assert.doesNotMatch(shell, /AcademicYearSelector/);
  assert.doesNotMatch(shell, /preserveAcademicContextHref\(item\.href/);
  assert.match(shell, /<AcademicContextBanner\s*\/>/);
});

test("Arquivo não adota implicitamente o ano ativo; seleção é local", () => {
  const navigation = src("lib/academic-year/navigation.ts");
  const archive = src("components/academico/AcademicArchiveHub.tsx");
  assert.match(navigation, /normalized\.endsWith\("\/arquivo"\)/);
  assert.match(archive, /setSelectedYearId/);
  assert.match(archive, /ano_letivo_id=\$\{encodeURIComponent\(selectedYear\.id\)\}/);
  assert.match(archive, /school-sessions/);
});

test("Central de Documentos envia o ano escolhido e recarrega períodos associados", () => {
  const hub = src("components/secretaria/QuickDocHub.tsx");
  assert.match(hub, /const anoSelecionado = selectedYearId/);
  assert.match(hub, /new URLSearchParams\(\{ escola_id: escolaId, ano_letivo_id: selectedYearId \}\)/);
  assert.doesNotMatch(hub, /const anoSelecionado = academicYearIdFromUrl/);
  assert.match(hub, /setTurmaId\(""/);
});

test("Turmas documentais são sempre filtradas por sessão autorizada", () => {
  const route = src("app/api/secretaria/documentos-oficiais/turmas/route.ts");
  assert.match(route, /resolveAcademicYearScope/);
  assert.match(route, /requestedAcademicYearId/);
  assert.match(route, /\.eq\("session_id", year\.id\)/);
  assert.match(route, /authorizeTurmasManage/);
});

test("Emissão oficial não envia ano da URL diretamente e respeita histórico encerrado", () => {
  const batch = src("components/secretaria/DocumentosOficiaisBatchClient.tsx");
  assert.match(batch, /setAcademicYearId/);
  assert.match(batch, /ano_letivo_id: academicYearId/);
  assert.match(batch, /isHistoricalYear/);
  assert.match(batch, /turmas\?ano_letivo_id=/);
  assert.match(batch, /periodos-letivos\?\$\{params\}/);
});

test("Dossier mostra o intervalo completo e abre apenas o ano solicitado", () => {
  const timeline = src("components/aluno/DossierHistoricoTimelineSection.tsx");
  assert.match(timeline, /formatAcademicYear/);
  assert.match(timeline, /ordered\.filter\(\(item\) => item\.ano_letivo === selectedYearNumber\)/);
  assert.match(timeline, /Ver todos os anos/);
});

test("Arquivo real exige escola/sessão, histórico fechado e bloqueia filtros de polo", () => {
  const route = src("app/api/secretaria/operacoes-academicas/arquivo/turmas/route.ts");
  const panel = src("components/academico/HistoricalTurmasPanel.tsx");
  assert.match(route, /authorizeTurmasManage/);
  assert.match(route, /resolveAcademicYearScope/);
  assert.match(route, /session\.status !== "CLOSED"/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("session_id", session\.id\)/);
  assert.match(panel, /mode=ano_letivo/);
  assert.match(panel, /ano_letivo_id=/);
});

test("Turmas SSR nunca apresentam turmas de outros anos se a view falhar", () => {
  const page = src("app/escola/[id]/(portal)/admin/turmas/page.tsx");
  assert.match(page, /resolveAcademicYearScope/);
  assert.match(page, /requestedAcademicYearId: anoLetivoIdParam/);
  const matches = page.match(/\.eq\('session_id', academicYearId\)/g) ?? [];
  assert.equal(matches.length, 2, "a view e o fallback ficam sempre no mesmo ano");
});

test("Documentos históricos apenas consultam ou descarregam, sem lançar notas", () => {
  const batch = src("components/secretaria/DocumentosOficiaisBatchClient.tsx");
  assert.match(batch, /isHistoricalYear \? \(/);
  assert.match(batch, /Lista histórica PDF/);
  assert.match(batch, /Ver turma/);
  assert.match(batch, /disabled=\{hasPendencias \|\| isHistoricalYear\}/);
});
