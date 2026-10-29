import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BALCAO_ACTION_REGISTRY, buildBalcaoActionHref } from "../../src/lib/balcao/action-registry";
import { readBalcaoStudentId, setBalcaoLocationContext } from "../../src/lib/balcao/return-context";

const read = (path: string) => readFileSync(`src/${path}`, "utf8");
const panel = read("components/secretaria/command-center/CommandCenterPanel.tsx");
const page = read("app/secretaria/balcao/BalcaoPageClient.tsx");
const retained = read("components/secretaria/command-center/RetainedActionPanels.tsx");
const inbox = read("components/secretaria/AdmissoesInboxClient.tsx");

test("admissões é operação canónica autónoma, dentro do Workspace", () => {
  assert.equal(BALCAO_ACTION_REGISTRY.admissions.requiresStudent, false);
  assert.equal(BALCAO_ACTION_REGISTRY.admissions.panel, "admissions");
  assert.match(panel, /dynamic\(\(\) => import\("@\/components\/secretaria\/AdmissoesInboxClient"\)/);
  assert.match(panel, /onNewAdmission=\{\(\) => onActionChange\("enrollment"\)\}/);
  assert.match(page, /activeAction === "admissions"/);
});

test("a fila carrega apenas quando visível e não mantém pedidos em segundo plano", () => {
  assert.match(retained, /action !== "admissions" \|\| activeAction === "admissions"/);
  assert.match(inbox, /dedupingInterval: 15000/);
  assert.match(inbox, /revalidateOnFocus: false/);
  assert.match(inbox, /if \(!hasSelectedCandidate\) return/);
  assert.match(inbox, /isConversionOpen && <AdmissaoConversionSheet/);
});

test("selecionar candidato não altera o URL do atendimento e cancela leituras obsoletas", () => {
  assert.match(inbox, /if \(!embedded\) \{/);
  assert.match(inbox, /new AbortController\(\)/);
  assert.match(inbox, /return \(\) => controller\.abort\(\)/);
  assert.match(inbox, /toastErrorRef\.current/);
  assert.match(panel, /inModal=\{inModal\}/);
});

test("admissões preserva o aluno anterior, enquanto nova matrícula começa sem aluno", () => {
  const original = new URLSearchParams("alunoId=aluno-123&ano_letivo_id=ano-1");
  const inboxParams = setBalcaoLocationContext(original, "aluno-123", "admissions");
  assert.equal(readBalcaoStudentId(inboxParams, "admissions"), "aluno-123");
  assert.equal(inboxParams.get("action"), "admissions");

  const enrollmentParams = setBalcaoLocationContext(inboxParams, "aluno-123", "enrollment");
  assert.equal(enrollmentParams.has("alunoId"), false);
  assert.equal(enrollmentParams.get("atendimentoAlunoId"), "aluno-123");
  assert.equal(enrollmentParams.get("ano_letivo_id"), "ano-1");

  const href = buildBalcaoActionHref({ escolaParam: "escola-demo", actionId: "admissions" });
  assert.match(href, /action=admissions/);
});
