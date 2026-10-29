import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classIdentityFromName, parseAcademicClassNumber, isPreschoolAcademicClass } from "../../src/lib/academico/class-level";

const root = process.cwd().endsWith("/apps/web") ? process.cwd() : resolve(process.cwd(), "apps/web");
const sql = readFileSync(resolve(root, "../../supabase/migrations/20271029140000_global_academic_class_metadata_contract.sql"), "utf8");
const install = readFileSync(resolve(root, "src/lib/academico/curriculum-apply.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/app/api/escolas/[id]/classes/route.ts"), "utf8");

test("all canonical numbered grades map to their actual level, not a display order", () => {
  for (let grade = 1; grade <= 13; grade += 1) {
    assert.equal(parseAcademicClassNumber(grade + "ª Classe"), grade);
    assert.deepEqual(classIdentityFromName(grade + "ª Classe"), { numero: grade, ordem: grade });
  }
  assert.equal(parseAcademicClassNumber("1º Ano"), 1);
  assert.equal(parseAcademicClassNumber("13º Ano"), 13);
});
test("preschool retains NULL numeric metadata, not a fictitious grade zero", () => {
  assert.ok(isPreschoolAcademicClass("Pré-Escolar"));
  assert.deepEqual(classIdentityFromName("Pré-Escolar"), { numero: null, ordem: 0 });
  assert.equal(parseAcademicClassNumber("Pré-Escolar"), null);
});
test("unknown labels are not silently assigned a class number", () => {
  for (const name of ["Classe B", "10º Trimestre", "Curso 2026", "14ª Classe", "Iniciação", "8ª Classe Extra"]) {
    assert.deepEqual(classIdentityFromName(name), { numero: null, ordem: null });
  }
});
test("admin class creation uses the shared canonical parser", () => {
  assert.match(admin, /classIdentityFromName\(parsed\.data\.nome\)/);
  assert.match(admin, /numero: classIdentity\.numero/);
  assert.match(admin, /curso_id: parsed\.data\.curso_id/);
  assert.match(admin, /numero: r\.numero \?\? null/);
});
test("curriculum preset installer supplies numeric metadata to class inserts", () => {
  assert.match(install, /classIdentityFromName\(nome\)/);
  assert.match(install, /identity\.numero !== null \? \{ numero: identity\.numero \} : \{\}/);
  assert.match(install, /curso_id: cursoId/);
});
test("database protects all paths including SECURITY DEFINER onboarding installers", () => {
  assert.match(sql, /trg_klasse_guard_class_identity/);
  assert.match(sql, /trg_klasse_guard_turma_class_binding/);
  assert.match(sql, /trg_klasse_guard_curso_matriz_binding/);
  assert.match(sql, /trg_klasse_guard_curso_curriculos_binding/);
  assert.match(sql, /CLASS_COURSE_TENANT_MISMATCH/);
  assert.match(sql, /TURMA_CLASS_COURSE_MISMATCH/);
  assert.match(sql, /MATRIX_CURRICULUM_BINDING_MISMATCH/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.klasse_guard_class_identity_v1/);
});
