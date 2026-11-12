import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=(path:string)=>readFileSync(resolve(process.cwd(),"src",path),"utf8");
test("rematrícula owns an accessible, dark/light token-based UX",()=>{
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(frame,/Próxima ação académica/);
 assert.match(frame,/Destino académico/);
 assert.match(frame,/aria-label="Próxima ação académica"/);
 assert.doesNotMatch(frame,/Pendências analisadas/);
 assert.match(frame,/border-border bg-muted/);
 assert.match(frame,/canContinue \? "Continuar rematrícula"/);
 assert.doesNotMatch(balc,/<RematriculaWorkspaceHeader/);
 assert.doesNotMatch(balc,/<RematriculaAcademicDestination/);
 assert.match(balc,/destinoTurma=\{rematricula\.destinoTurma\}/);
});
test("source eligibility gates destination and never creates a client-side RAA override",()=>{
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(frame,/disabled=\{!canContinue\}/);
 assert.match(balc,/canContinueEnrollment=\{/);
 assert.match(balc,/onContinueEnrollment=\{rematricula.openModal\}/);
 assert.match(balc,/rematricula\.cardState === "READY"/);
 assert.doesNotMatch(frame,/UPDATE public\.matriculas|resultado_final =/);
});
test("the student, process and wizard remain in one workspace, without modal auto-open",()=>{
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(balc,/Aluno selecionado para situação académica/);
 assert.match(balc,/searchOpen \|\| view === "reenrollment"/);
 assert.match(balc,/balcao-rematricula-wizard/);
 assert.doesNotMatch(balc,/autoOpenedRematriculaRef/);
 assert.doesNotMatch(balc,/view === "reenrollment" && rematricula\.modalOpen \? \(/);
});
test("a case remains selected with its form while the process list stays visible",()=>{
 const panel=source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
 assert.match(panel,/phase === "summary" \|\| phase === "detail"/);
 assert.match(panel,/activeCase\?\.id === item\.id/);
 assert.match(panel,/aria-expanded=/);
 assert.match(panel,/buildRaaBalcaoWorkspaceCases/);
 assert.match(panel,/Consulta parcial:/);
});

test("academic header has one clear action; calendar detail is optional", () => {
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 assert.match(frame,/Ver pendências/);
 assert.match(frame,/<details className="rounded-xl border border-border bg-muted\/20 p-3" aria-label="Calendário de origem">/);
 assert.doesNotMatch(frame,/Matrícula de destino identificada/);
 assert.doesNotMatch(frame,/Ver e resolver pendências/);
});
test("RAA panel resolves names from authorized source school, not invented labels", () => {
 const panel=source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
 const api=source("app/api/secretaria/balcao/raa/exam-context/route.ts");
 assert.match(panel,/disciplinaNames: nomesDisciplinas/);
 assert.match(api,/from\("disciplinas_catalogo"\)\.select\("id,nome"\)/);
 assert.match(api,/\.eq\("escola_id", escolaId\)\.in\("id", disciplinaIds\)/);
 assert.match(panel,/hasTrimesterCases/);
 assert.doesNotMatch(panel,/disciplinas com elementos pendentes/);
});

test("non-actionable reenrollment shows the destination without a dead button", () => {
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 assert.match(frame,/canContinue && !completed && !destinationEnrolled && !cycleCompleted/);
 assert.match(frame,/pendingSubjectsActionForBalcao/);
});
test("individual-grade action preserves selected discipline and never bypasses source checks", () => {
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 const modal=source("components/secretaria/EnrollmentPostActionModal.tsx");
 assert.match(balc,/onLancarNota=\{\(trimestre, disciplinaId\) => \{/);
 assert.match(balc,/initialDisciplinaId: disciplinaId \?\? null/);
 assert.match(modal,/initialDisciplinaId\?: string \| null/);
 assert.match(modal,/item\.disciplina\?\.id === initialDisciplinaId/);
 assert.match(modal,/setTurmaDisciplinaId\(found\?\.id \?\? ""\)/);
});
