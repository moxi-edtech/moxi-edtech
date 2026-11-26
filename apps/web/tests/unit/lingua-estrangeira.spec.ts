import test from "node:test";
import assert from "node:assert/strict";
import { idiomaSchema, isLinguaEstrangeira } from "../../src/lib/academico/lingua-estrangeira";

test("idiomas predefinidos e outro idioma são validados", () => {
  for (const idioma of ["en","fr","es"]) {
    assert.equal(idiomaSchema.safeParse({ idioma, outro: null }).success, true);
    assert.equal(idiomaSchema.safeParse({ idioma, outro: "Alemão" }).success, false);
  }
  assert.deepEqual(idiomaSchema.parse({ idioma: "other", outro: " Alemão " }), { idioma: "other", outro: "Alemão" });
  for (const outro of [null, "", " ", "A", "a".repeat(81), "ab\ncd"]) {
    assert.equal(idiomaSchema.safeParse({ idioma: "other", outro }).success, false);
  }
  assert.equal(idiomaSchema.safeParse({ idioma: "xx" }).success, false);
  assert.equal(idiomaSchema.safeParse({ idioma: "en", escola_id: "forged" }).success, false);
});

test("reconhece disciplina canónica sem confundir Língua Portuguesa", () => {
  assert.equal(isLinguaEstrangeira(" Língua  Estrangeira "), true);
  assert.equal(isLinguaEstrangeira("lingua estrangeira"), true);
  assert.equal(isLinguaEstrangeira("Língua Portuguesa"), false);
  assert.equal(isLinguaEstrangeira("Inglês"), false);
});
