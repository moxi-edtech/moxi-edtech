import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=(path:string)=>readFileSync(resolve(process.cwd(),"src",path),"utf8");
test("rematrícula owns an accessible, dark/light token-based UX",()=>{
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(frame,/Elegibilidade académica/);
 assert.match(frame,/Destino académico/);
 assert.match(frame,/role="progressbar"/);
 assert.match(frame,/border-border bg-muted/);
 assert.match(frame,/canContinue \? "Continuar rematrícula"/);
 assert.match(balc,/RematriculaWorkspaceHeader/);
 assert.match(balc,/RematriculaAcademicDestination/);
 assert.match(balc,/rematriculaDestinoTurma=\{rematricula\.destinoTurma\}/);
});
test("source eligibility gates destination and never creates a client-side RAA override",()=>{
 const frame=source("components/secretaria/RematriculaWorkspaceChrome.tsx");
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(frame,/disabled=\{!canContinue\}/);
 assert.match(balc,/canContinue=\{rematriculaReady && !rematriculaWizardOpen\}/);
 assert.match(balc,/onContinue=\{onRematricula\}/);
 assert.match(balc,/rematricula\.cardState === "READY"/);
 assert.doesNotMatch(frame,/UPDATE public\.matriculas|resultado_final =/);
});
test("the student, process and wizard remain in one workspace, without modal auto-open",()=>{
 const balc=source("components/secretaria/BalcaoAtendimento.tsx");
 assert.match(balc,/Aluno selecionado para rematrícula/);
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
