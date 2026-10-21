import assert from "node:assert/strict";
import test from "node:test";

import { createEntityContext } from "../../src/lib/command-center/entity-context";
import { courseContextHref, courseContextQueryKey } from "../../src/hooks/useCourseContext";

const result = (type: string, id = "curso-1") => ({
  id,
  type,
  label: "  Informática ",
  href: "/admin/configuracoes",
}) as Parameters<typeof createEntityContext>[0];

test("a pesquisa abre apenas entidades contextuais com escola identificada", () => {
  const curso = createEntityContext(result("curso"), "escola-A", "ano-2026");
  assert.deepEqual(curso, {
    id: "curso-1",
    type: "curso",
    label: "Informática",
    escolaId: "escola-A",
    academicYearId: "ano-2026",
  });
  for (const type of ["classe", "turma", "professor"]) {
    assert.equal(createEntityContext(result(type), "escola-A", null)?.type, type);
  }
  for (const type of ["aluno", "candidatura", "pagamento", "mensalidade"]) {
    assert.equal(createEntityContext(result(type), "escola-A", null), null);
  }
  assert.equal(createEntityContext(result("curso"), null, null), null);
  assert.equal(createEntityContext(result("curso", ""), "escola-A", null), null);
});

test("a URL codifica escola, curso e preserva o ano letivo", () => {
  const context = createEntityContext(result("curso", "abc/def"), "escola com espaços", "ano-2026");
  assert.ok(context);
  assert.equal(
    courseContextHref(context),
    "/api/escolas/escola%20com%20espa%C3%A7os/command-center/cursos/abc%2Fdef?ano_letivo_id=ano-2026",
  );
  assert.equal(
    courseContextHref({ ...context, academicYearId: null }),
    "/api/escolas/escola%20com%20espa%C3%A7os/command-center/cursos/abc%2Fdef",
  );
});

test("chaves de cache são isoladas por escola, curso e ano letivo", () => {
  const first = createEntityContext(result("curso"), "escola-A", "ano-2026");
  assert.ok(first);
  assert.notDeepEqual(courseContextQueryKey(first), courseContextQueryKey({ ...first, escolaId: "escola-B" }));
  assert.notDeepEqual(courseContextQueryKey(first), courseContextQueryKey({ ...first, id: "curso-2" }));
  assert.notDeepEqual(courseContextQueryKey(first), courseContextQueryKey({ ...first, academicYearId: "ano-2025" }));
});
