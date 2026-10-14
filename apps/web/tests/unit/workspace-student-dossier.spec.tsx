import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandCenterShell } from "../../src/components/secretaria/command-center/CommandCenterShell";

const source = (path: string) => readFileSync("src/" + path, "utf8");
const modal = source("components/secretaria/BalcaoWorkspace.tsx");
const page = source("app/secretaria/balcao/BalcaoPageClient.tsx");
const panel = source("components/secretaria/command-center/CommandCenterPanel.tsx");
const picker = source("components/secretaria/command-center/CommandCenterStudentPicker.tsx");
const dossier = source("components/secretaria/command-center/CommandCenterStudentDossier.tsx");
const dossierRoute = source("app/api/secretaria/alunos/[id]/dossier/route.ts");
const dossierLoader = source("lib/aluno/load-dossier-data.ts");
const existingPage = source("components/aluno/AlunoPerfilPage.tsx");

test("Trocar aluno is present in every student-bound Command Center tab", () => {
  for (const activeAction of ["desk", "payment", "document", "reenrollment", "profile", "grade"] as const) {
    const markup = renderToStaticMarkup(React.createElement(CommandCenterShell, {
      variant: "modal",
      student: { id: "synthetic-student", label: "Estudante de teste" },
      activeAction,
      onActionChange: () => {},
      onSwitchStudent: () => {},
      onClose: () => {},
      children: React.createElement("div", {}, "Painel"),
    }));
    assert.match(markup, /Trocar aluno/, activeAction);
  }
});

test("student switch is not offered when enrollment does not target the selected student", () => {
  const markup = renderToStaticMarkup(React.createElement(CommandCenterShell, {
    variant: "modal",
    student: { id: "synthetic-student", label: "Estudante de teste" },
    activeAction: "enrollment",
    onActionChange: () => {},
    onSwitchStudent: () => {},
    children: React.createElement("div", {}, "Nova matrícula"),
  }));
  assert.doesNotMatch(markup, /Trocar aluno/);
});

test("modal and standalone workspace wire a protected student-switch callback", () => {
  assert.match(modal, /onSwitchStudent=\{switchingStudent \? undefined : handleSwitchStudent\}/);
  assert.match(page, /onSwitchStudent=\{handleSwitchStudent\}/);
  assert.match(modal, /window\.confirm\(/);
  assert.match(modal, /setActiveAction\("desk"\); \/\/ reset all student-bound panels/);
  assert.match(modal, /studentRequestRef\.current \+= 1/);
  assert.match(modal, /key=\{selectedStudent\.id\}/);
  assert.match(modal, /onCancel=\{\(\) => setSwitchingStudent\(false\)\}/);
  assert.match(picker, /student\.id !== currentAlunoId/);
});

test("the full profile is not replaced by an edit-only form", () => {
  assert.match(panel, /CommandCenterStudentDossier/);
  assert.match(panel, /Perfil integral do aluno/);
  assert.match(panel, /Atualizar dados pessoais/);
  assert.match(panel, /profileRefreshKey/);
  for (const section of [
    "DossierPerfilSection",
    "DossierFinanceiroSection",
    "DossierHistoricoSection",
    "DossierHistoricoTransitadoSection",
    "DossierDocumentosSection",
  ]) assert.match(dossier, new RegExp(section));
  assert.match(dossier, /controller\.abort\(\)/);
  assert.match(dossier, /body\.aluno\.id !== alunoId/);
  assert.match(dossier, /private, no-store/);
});

test("the existing full profile and the workspace use exactly the same dossier loader", () => {
  assert.match(existingPage, /loadAlunoDossierData\(/);
  assert.match(dossierRoute, /loadAlunoDossierData\(/);
  assert.match(dossierLoader, /get_aluno_dossier/);
  assert.match(dossierLoader, /normalizeDossier/);
  assert.match(dossierLoader, /documentos_emitidos/);
  assert.match(dossierLoader, /extractServicosFromPagamentos/);
});

test("dossier API fails closed on cross-school students and requires operational role", () => {
  assert.match(dossierRoute, /requireRoleInSchool/);
  assert.match(dossierRoute, /K12_SECRETARIA_OPERACIONAL_ROLE_GROUP/);
  assert.match(dossierRoute, /resolveEscolaIdForUser\(supabase, user\.id\)/);
  assert.match(dossierRoute, /\.eq\("escola_id", escolaId\)/);
  assert.match(dossierRoute, /z\.string\(\)\.uuid\(\)/);
  assert.match(dossierRoute, /Cache-Control": "private, no-store/);
});

test("grade panel allows authorized turma choice when the contextual lookup has no class", () => {
  assert.match(panel, /lockTurma=\{Boolean\(turmaId\)\}/);
  assert.match(modal, /turmaId=\{studentContext\?\.turmaId \?\? null\}/);
});
