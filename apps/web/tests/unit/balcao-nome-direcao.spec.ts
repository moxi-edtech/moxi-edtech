import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canCorrigirNomeAluno } from "../../src/lib/aluno/nome-permissions";

const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const sql = readFileSync(
  new URL("../../../../supabase/migrations/20271113090000_corrigir_nome_aluno_balcao.sql", import.meta.url),
  "utf8",
);

test("só os papéis explícitos de Direção corrigem nomes", () => {
  for (const papel of ["diretor", "admin", "admin_escola", "staff_admin"]) {
    assert.equal(canCorrigirNomeAluno(papel), true, papel);
  }
  for (const papel of ["secretaria", "admin_secretaria", "admin_financeiro", "financeiro", "professor", "aluno", null, undefined]) {
    assert.equal(canCorrigirNomeAluno(papel), false, String(papel));
  }
});

test("o Balcão e a ficha completa recebem a permissão do servidor", () => {
  const dossierApi = source("app/api/secretaria/alunos/[id]/dossier/route.ts");
  const commandCenter = source("components/secretaria/command-center/CommandCenterStudentDossier.tsx");
  const page = source("components/aluno/AlunoPerfilPage.tsx");
  const section = source("components/aluno/DossierSeccoes.tsx");
  for (const code of [dossierApi, page]) {
    assert.match(code, /canCorrigirNomeAluno/);
    assert.match(code, /\.from\("escola_users"\)/);
  }
  assert.match(dossierApi, /canEditNome/);
  assert.match(commandCenter, /canEditNome=\{data\.canEditNome\}/);
  assert.match(commandCenter, /onNomeChanged=/);
  assert.match(section, /fieldName="nome"/);
  assert.match(section, /alwaysVisible/);
});

test("a API não pode atualizar nome por UPDATE genérico", () => {
  const route = source("app/api/secretaria/alunos/[id]/route.ts");
  const editor = source("components/aluno/QuickEditField.tsx");
  assert.match(route, /corrigir_nome_aluno_balcao/);
  assert.match(route, /p_nome_anterior/);
  assert.doesNotMatch(route, /toUpdateAluno\.nome\s*=/);
  assert.doesNotMatch(route, /toUpdateProfile\.nome\s*=/);
  assert.match(editor, /nome_anterior: value/);
});

test("a RPC valida escola, identidade, concorrência e auditoria na mesma transação", () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /eu\.escola_id = v_escola_id/);
  assert.match(sql, /eu\.user_id = v_actor/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /p_nome_anterior IS NOT NULL/);
  assert.match(sql, /UPDATE public\.alunos SET nome/);
  assert.match(sql, /UPDATE public\.profiles SET nome/);
  assert.match(sql, /INSERT INTO public\.audit_logs/);
  assert.match(sql, /ALUNO_NOME_CORRIGIDO/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
  assert.match(sql, /TO authenticated/);
});
