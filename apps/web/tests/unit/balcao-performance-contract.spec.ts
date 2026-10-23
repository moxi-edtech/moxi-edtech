import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readBalcaoStudentId, setBalcaoLocationContext } from "../../src/lib/balcao/return-context";

const source = (path: string) => readFileSync("src/"+path,"utf8");
const page = source("app/secretaria/balcao/BalcaoPageClient.tsx");
const modal = source("components/secretaria/BalcaoWorkspace.tsx");
const panel = source("components/secretaria/command-center/CommandCenterPanel.tsx");
const retained = source("components/secretaria/command-center/RetainedActionPanels.tsx");
const atendimento = source("components/secretaria/BalcaoAtendimento.tsx");
const admission = source("components/secretaria/AdmissaoWizardClient.tsx");
const reenroll = source("hooks/useRematriculaBalcao.ts");

test("retains real React panels but never retains a student across identity boundaries", () => {
  assert.match(retained,/setVisited\(/);
  assert.match(retained,/hidden=\{!active\}/);
  assert.match(retained,/inert=\{!active\}/);
  assert.match(retained,/contextSignature/);
  assert.match(modal,/!userScope \? \(/,"unverified alternate entrypoints must fail closed without student memory cache");
  assert.match(modal,/\$\{userScope\}:\$\{escolaId\}:\$\{poloScope\}:\$\{selectedStudent\.id\}/);
  assert.match(page,/\$\{userScope\}:\$\{escolaId\}:\$\{searchParams\?\.get\("polo_id"\)/);
  assert.match(page,/setAtendimentoKey\(\(key\) => key \+ 1\)/);
});

test("new enrollment is independent; browser back restores the suspended student", () => {
  const first = new URLSearchParams("alunoId=fixture-aluno&ano_letivo_id=fixture-year");
  const during = setBalcaoLocationContext(first,"fixture-aluno","enrollment");
  assert.equal(during.get("alunoId"),null);
  assert.equal(during.get("atendimentoAlunoId"),"fixture-aluno");
  assert.equal(during.get("ano_letivo_id"),"fixture-year");
  const returned = setBalcaoLocationContext(during,readBalcaoStudentId(during,"enrollment"),"document");
  assert.equal(returned.get("alunoId"),"fixture-aluno");
  assert.equal(returned.has("atendimentoAlunoId"),false);
  assert.match(page,/alunoId=\{panelAction === "enrollment" \? null : selectedAlunoId\}/);
  assert.match(modal,/alunoId=\{panelAction === "enrollment" \? null : selectedStudent\.id\}/);
  assert.match(panel,/modalContext=\{inModal\}/);
});

test("dirty input, receipts and checkout selections survive tab switches and are confirmed before discard", () => {
  const draft = source("components/secretaria/command-center/BalcaoDraftState.tsx");
  assert.match(retained,/BalcaoDraftScope/);
  assert.doesNotMatch(retained,/onClickCapture|onInputCapture|onChangeCapture/);
  assert.match(draft,/useBalcaoDraftForm/);
  assert.match(draft,/JSON.stringify\(value\) !== JSON.stringify\(baseline\)/);
  assert.match(retained,/beforeunload/);
  assert.match(modal,/hasUnsavedWorkRef\.current/);
  assert.match(modal,/hasUnsavedWorkRef\.current && !window\.confirm/);
  assert.match(page,/activeAction === "enrollment" && unsavedWorkRef\.current/);
  assert.match(page,/if \(unsavedWorkRef\.current && !window\.confirm/);
  assert.match(page,/unsavedWorkRef\.current/);
  assert.match(page,/window\.confirm/);
});

test("latest asynchronous student RPC wins; a stale response cannot replace current student", () => {
  assert.match(atendimento,/const requestGeneration = useRef\(0\)/);
  assert.match(atendimento,/const generation = \+\+requestGeneration\.current/);
  assert.match(atendimento,/if \(generation !== requestGeneration\.current\) return false/);
  assert.match(atendimento,/requestGeneration\.current \+= 1/);
  assert.match(page,/if \(aluno\?\.id\) handleAlunoSelected\(aluno\)/);
});

test("financial state is invalidated and confirmed with authoritative read-back before settlement is displayed", () => {
  const reloadIndex=atendimento.indexOf("const verified = await onSuccess();");
  const settledIndex=atendimento.indexOf('if (settlement.state === "settled")');
  assert.ok(reloadIndex >= 0 && settledIndex > reloadIndex);
  assert.match(atendimento,/if \(!verified\) \{[\s\S]*?setPagos\(\[\]\)/);
  assert.match(atendimento,/const verified = await dossier\.load\(dossier\.aluno\.id\)/);
  assert.match(atendimento,/refreshRevision > lastRevisionRef\.current/);
  assert.match(atendimento,/!visible \|\| refreshRevision <= lastRevisionRef\.current/);
  assert.match(page,/setRefreshRevision\(\(value\) => value \+ 1\)/);
  assert.match(modal,/setRefreshRevision\(\(value\) => value \+ 1\)/);
  assert.match(atendimento,/resolveCheckoutPaymentState\(json\)/);
});

test("private enrollment/reenrollment drafts have user+polo+school scope, cleanup and fail-closed fallback",()=>{
  assert.match(admission,/draftScope \? `klasse:admissao:draft:\$\{draftScope\}:\$\{escolaId\}` : null/);
  assert.match(admission,/window\.localStorage\.removeItem\(`admissao:draft:\$\{escolaId\}`\)/);
  assert.match(admission,/if \(!key\) return null/);
  assert.match(reenroll,/opts\.draftScope && opts\.alunoId && opts\.matriculaId/);
  assert.match(reenroll,/if \(!draftKey \|\| !opts\.alunoId/);
  const logout=source("components/auth/SignOutButton.tsx");
  for (const prefix of ["admissao:draft:", "klasse:admissao:draft:", "klasse:rematricula:draft:"]) assert.ok(logout.includes(prefix));
  assert.match(logout,/\['localStorage', 'sessionStorage'\]/);
  assert.match(logout,/window\[storageName\]/);
});
