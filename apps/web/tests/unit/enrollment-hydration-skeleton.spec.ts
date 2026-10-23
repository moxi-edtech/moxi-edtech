import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveEnrollmentCandidateId } from "../../src/lib/balcao/enrollment-entry";

const wizard = readFileSync(new URL("../../src/components/secretaria/AdmissaoWizardClient.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../src/components/secretaria/command-center/CommandCenterPanel.tsx", import.meta.url), "utf8");
const retained = readFileSync(new URL("../../src/components/secretaria/command-center/RetainedActionPanels.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../src/components/secretaria/BalcaoWorkspace.tsx", import.meta.url), "utf8");

test("new application normalizes missing ID so the first hydration effect runs", () => {
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: false, modalContext: true,
    resumedId: null, initialId: undefined, queryId: undefined,
  }), null);
  assert.match(wizard, /const lastCandidaturaIdRef = useRef<string \| null \| undefined>\(undefined\)/);
  assert.match(wizard, /const candId = resolveEnrollmentCandidateId\(/);
  assert.match(wizard, /if \(candId === lastCandidaturaIdRef\.current\) return;/);
  assert.match(wizard, /setHydrated\(true\);[\s\S]*?setHydratingLead\(false\);/);
});

test("workspace enrollment ignores selected student, initial candidature and URL query", () => {
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: true, modalContext: true,
    resumedId: null, initialId: "old-candidate", queryId: "old-query",
  }), null);
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: true, modalContext: false,
    resumedId: null, initialId: "old-candidate", queryId: "old-query",
  }), null);
  assert.match(panel, /<AdmissaoWizardClient[\s\S]*?newCandidateOnly/);
  assert.match(workspace, /alunoId=\{panelAction === "enrollment" \? null : selectedStudent\.id\}/);
  assert.match(workspace, /const studentInContextId = activeAction === "enrollment" \? null : selectedStudent\.id;/);
  assert.match(workspace, /if \(activeAction === "enrollment" \|\| submittingRef\.current\) return;/);
  assert.match(wizard, /newCandidateOnly \? undefined : draftScope/g);
});

test("resuming an existing candidate is only explicit for workspace enrollment", () => {
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: true, modalContext: true,
    resumedId: "chosen-draft", initialId: "old-candidate", queryId: "old-query",
  }), "chosen-draft");
  assert.match(wizard, /if \(modalContext \|\| newCandidateOnly\) \{[\s\S]*?setModalResumeId\(id\)/);
  assert.match(wizard, /if \(!newCandidateOnly && hydrated && !candidaturaId\) void loadDrafts\(\)/);
  assert.match(wizard, /!newCandidateOnly && !candidaturaId && !dismissedResumePrompt/);
  assert.match(wizard, /Retomar rascunho/);
});

test("legacy and non-workspace entrypoints still honor provided candidate IDs", () => {
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: false, modalContext: false,
    resumedId: "other", initialId: "explicit-candidate", queryId: "query-candidate",
  }), "explicit-candidate");
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: false, modalContext: false,
    resumedId: null, initialId: null, queryId: "query-candidate",
  }), "query-candidate");
  assert.equal(resolveEnrollmentCandidateId({
    newCandidateOnly: false, modalContext: true,
    resumedId: "selected-draft", initialId: "explicit-candidate", queryId: "query-candidate",
  }), "selected-draft");
});

test("leaving enrollment unmounts its form without losing other student tabs", () => {
  assert.match(retained, /mounted\.filter\(action => action !== "enrollment" \|\| activeAction === "enrollment"\)/);
  assert.match(retained, /delete next\.enrollment/);
  assert.match(workspace, /const \[selectedStudent, setSelectedStudent\] = useState<Student>\(aluno\)/);
  assert.match(workspace, /setActiveAction\(next\)/);
  assert.match(workspace, /const enrollmentDirty = Boolean\(actionDraftStatuses\.enrollment\?\.dirty\)/);
  assert.match(workspace, /!enrollmentDirty/);
  assert.match(workspace, /const otherTabsDirty = Object\.entries\(actionDraftStatuses\)/);
});
