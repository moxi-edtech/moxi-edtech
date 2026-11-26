import * as React from "react";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfessorIntervencoesSkeleton, ProfessorAtividadeDetalheSkeleton } from "../../src/components/professor/ProfessorLoadingSkeletons";

const code = (relative: string) => readFileSync(new URL(`../../src/${relative}`, import.meta.url), "utf8");

test("professor intervention and activity loading match real cards, with screen reader status and reduced motion", () => {
  for (const Component of [ProfessorIntervencoesSkeleton, ProfessorAtividadeDetalheSkeleton]) {
    const html = renderToStaticMarkup(<Component />);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /motion-safe:animate-pulse/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /class="animate-pulse/);
  }
});

test("teacher interventions and activity details reuse canonical page inset rather than fixed backdrop or duplicate margins", () => {
  for (const path of ["app/professor/intervencoes/page.tsx", "app/professor/atividades/[id]/page.tsx"]) {
    const src = code(path);
    assert.match(src, /PORTAL_PAGE_INSET/);
    assert.doesNotMatch(src, /bg-\[#f8fafc\]|rounded-3xl/);
  }
  const activity = code("app/professor/atividades/[id]/page.tsx");
  assert.match(activity, /Voltar às actividades/);
  assert.match(activity, /<ProfessorAtividadeDetalheSkeleton\s*\/>/);
  const interventions = code("app/professor/intervencoes/page.tsx");
  assert.match(interventions, /<ProfessorIntervencoesSkeleton\s*\/>/);
  assert.match(interventions, /disabled=\{updatingId === item.id \|\| item.status === "concluida"\}/);
});

test("student dashboard fallback stays announced and respects reduced-motion preferences", () => {
  const source = code("app/(portal-aluno)/aluno/dashboard/page.tsx");
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /motion-safe:animate-pulse/);
  assert.match(source, /<DashboardLoader\s*\/>/);
});

test("secretary dashboard skeletons are accessible, theme-aware and non-blocking", () => {
  const skeleton = code("app/secretaria/(portal-secretaria)/DashboardSkeleton.tsx");
  const dashboard = code("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  assert.match(skeleton, /aria-label="A carregar painel da Secretaria"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /motion-safe:animate-pulse/);
  assert.doesNotMatch(skeleton, /rounded-2xl|space-y-8 animate-pulse/);
  assert.match(dashboard, /A carregar resumo de caixa/);
  assert.match(dashboard, /A carregar produtividade/);
  assert.match(dashboard, /A carregar formulário/);
});

test("financial workspace keeps URL view switch but surfaces an accessible responsive selector", () => {
  const source = code("app/escola/[id]/(portal)/financeiro/tabelas-mensalidade/MensalidadesPrecosWorkspace.tsx");
  assert.match(source, /PORTAL_PAGE_INSET/);
  assert.match(source, /aria-pressed=\{view === "mensalidades"\}/);
  assert.match(source, /aria-pressed=\{view === "precos"\}/);
  assert.match(source, /window\.history\.replaceState\(null, "", url\)/);
  assert.match(source, /<TabelasMensalidadeClient escolaId=\{escolaId\}/);
  assert.match(source, /<PrecosClient escolaId=\{escolaId\} embedded/);
  assert.match(source, /focus-visible:ring-klasse-gold\/20/);
  assert.match(source, /aria-label="A carregar configurações financeiras"/);
});

test("admin communications retains provider actions and pairs every form label with its control", () => {
  const source = code("app/escola/[id]/(portal)/admin/configuracoes/comunicacao/page.tsx");
  for (const id of ["waha-display-name", "waha-provider-status", "waha-session-name", "waha-fallback-phone"]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }
  assert.match(source, /fieldControlClass/);
  assert.match(source, /fieldFocusClass/);
  assert.match(source, /saveConfig/);
  assert.match(source, /onClick=\{loadQr\}/);
  assert.match(source, /aspect-square h-auto w-full max-w-64/);
  assert.match(source, /PORTAL_PAGE_INSET/);
});

test("teacher grading and calendar preserve their operational logic with the canonical page geometry", () => {
  const grade = code("components/professor/ProfessorGradesWorkspace.tsx");
  const calendar = code("components/professor/ProfessorCalendarWorkspace.tsx");
  for (const src of [grade, calendar]) assert.match(src, /PORTAL_PAGE_INSET/);
  assert.match(grade, /import \{ PORTAL_PAGE_INSET \} from "@\/lib\/layout\/portal-page"/);
  assert.match(grade, /resolveGradeEntryAvailability\(/);
  assert.match(grade, /const notasBloqueadas = !gradeAvailability.canWrite/);
  assert.match(calendar, /<ProfessorCalendarSkeleton/);
});
