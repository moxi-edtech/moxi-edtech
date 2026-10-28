import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = new URL("../../src/", import.meta.url);
const read = (name) => readFileSync(new URL(name, src), "utf8");
const migration = readFileSync(new URL("../../../../supabase/migrations/20271028160000_aluno_faltas_justificacoes.sql", import.meta.url), "utf8");

test("aba Faltas preserva contexto e fica separada dos documentos pagos", () => {
  const workspace = read("components/aluno/academico/AcademicoWorkspace.tsx");
  assert.match(workspace, /id: "faltas"/);
  assert.match(workspace, /academic-panel-faltas/);
  assert.match(workspace, /<TabFaltas \/>/);
  assert.match(workspace, /visited\.includes\("faltas"\)/);
  const view = read("components/aluno/tabs/TabFaltas.tsx");
  assert.match(view, /params\.set\("studentId", studentId\)/);
  assert.match(view, /params\.set\("ano_letivo_id", yearId\)/);
  assert.match(view, /scope === query \? data : null/);
  assert.match(view, /Aguardando análise da secretaria/);
});

test("GET preserva escola, matrícula, ano e visibilidade independente de pagamento", () => {
  const api = read("app/api/aluno/faltas/route.ts");
  for (const source of [
    /getAlunoContext\(\)/,
    /resolveSelectedStudentId\(/,
    /resolveBoletimMatricula\(/,
    /matriculaId: resolved\.matricula\.id/,
    /eq\("escola_id", scope\.escolaId\)/,
    /eq\("matricula_id", scope\.matriculaId\)/,
    /eq\("status", "falta"\)/,
  ]) assert.match(api, source);
  assert.doesNotMatch(api, /checkBoletimAccess|DOC_BOLETIM_TRIMESTRAL|\.from\("pagamentos"\)/);
});

test("requerimento exige encarregado ou aluno maior de idade e falta real", () => {
  const api = read("app/api/aluno/faltas/route.ts");
  assert.match(api, /canRequestJustification/);
  assert.match(api, /data_nascimento/);
  assert.match(api, /aluno_encarregados/);
  assert.match(api, /operation,/);
  assert.match(api, /eq\("status", "falta"\)/);
  assert.match(api, /idempotent: true/);
  assert.match(migration, /aluno_falta_justificacoes_submit/);
  assert.match(migration, /data_nascimento <=/);
  assert.match(migration, /aluno_encarregados/);
  assert.match(migration, /submitted_by = \(SELECT auth\.uid\(\)\)/);
});

test("aprovação exige papel escolar e nunca apaga a falta nem aprova pagamentos", () => {
  const staff = read("app/api/secretaria/faltas/justificacoes/route.ts");
  assert.match(staff, /requireRoleInSchool/);
  assert.match(staff, /\.eq\("status", "pending"\)/);
  assert.match(staff, /\.eq\("status", "falta"\)/);
  assert.match(staff, /recordAuditServer/);
  assert.doesNotMatch(staff, /from\("frequencias"\)\s*\.update|from\("pagamento_intents"\)|validar_pagamento/);
  assert.match(migration, /uq_falta_justificacao_open_or_approved/);
  assert.match(migration, /ROW LEVEL SECURITY/);
  assert.match(migration, /GRANT UPDATE \(status,reviewed_by,reviewed_at,decision_reason\)/);
});

test("fila de decisão é ligada à secretaria e requer motivo para rejeição", () => {
  const ws = read("components/secretaria/SecretariaDocumentosWorkspace.tsx");
  const q = read("components/secretaria/FaltasJustificacoesQueue.tsx");
  assert.match(ws, /<FaltasJustificacoesQueue \/>/);
  assert.match(q, /DialogContent/);
  assert.match(q, /decision === "rejected" && reason\.trim\(\)\.length < 8/);
  assert.match(q, /A ausência original continuará no histórico/);
});
