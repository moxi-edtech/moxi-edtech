import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("Rematrícula uses the origin enrollment from the server, not the dossier's current enrollment", () => {
  const api = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  const gradeModal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(api, /source:\s*\{\s*matricula_id:\s*matriculaOrigem\.id/);
  assert.match(api, /ano_letivo_id:\s*matriculaOrigem\.session_id/);
  assert.match(workspace, /raaMatriculaId=\{rematricula\.academic\?\.source\?\.matricula_id \?\? null\}/);
  assert.doesNotMatch(workspace, /raaMatriculaId=\{dossier\.aluno\.matricula_id/);
  assert.match(workspace, /originAnoLetivoId:\s*source\.ano_letivo_id/);
  assert.match(gradeModal, /setAcademicYearId\(originAnoLetivoId\)/);
});

test("Documents are emitted/charged inside Rematrícula with the existing checkout", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /onDocumentos=\{\(\) => setRaaDocumentsOpen\(true\)\}/);
  assert.match(workspace, /data-balcao-raa-documents/);
  assert.match(workspace, /if \(paid\) void onAdicionarServico\(servico\); else void onEmitirDocumento\(servico\)/);
  assert.match(workspace, /view === "reenrollment" && raaDocumentsOpen && selectedItemKeys\.size > 0/);
  assert.match(workspace, /onCloseRaaDocuments=\{\(\) => setRaaDocumentsOpen\(false\)\}/);
});

test("Exams display previously submitted components and preserve writer idempotency", () => {
  const api = source("app/api/secretaria/balcao/raa/exam-context/route.ts");
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  assert.match(api, /from\("exame_resultados"\)/);
  assert.match(api, /eq\("matricula_id", matricula\.id\)/);
  assert.match(panel, /previousExamResult/);
  assert.match(panel, /Boolean\(previousExamResult\)/);
  assert.match(panel, /await refreshAfterSave\(\)/);
  assert.match(panel, /A refresh error must never make it/);
});

test("Old academic decisions cannot be overwritten by a client-only remission", () => {
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  assert.match(panel, /await readJson\("\/api\/academico\/exames\/resultados"/);
  assert.match(panel, /await onRecheck\(\)/);
  assert.match(status, /academicEligibility = classifyRematriculaAcademicEligibility/);
});
