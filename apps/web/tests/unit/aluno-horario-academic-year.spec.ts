import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase";
import { resolveStudentTimetableTurma } from "../../src/lib/aluno/resolveStudentTimetableTurma";

const year = "d9cd907e-ae4e-470a-830e-b636c68bda66";
const otherYear = "6799e1f7-ce4d-41ee-89eb-6bfbbf2a9833";
const school = "59bb4670-81b3-4cff-99a0-c421a4b116d1";
const clazz = "ad1e98db-534a-4717-9505-9e022ad0bd56";

function fakeSupabase(
  row: { id: string; session_id: string | null } | null,
  error: Error | null = null,
) {
  const filters: Record<string, unknown> = {};
  const query = {
    select(_projection: string) { return this; },
    eq(field: string, value: unknown) { filters[field] = value; return this; },
    async maybeSingle() { return { data: row, error }; },
  };
  const db = {
    from(table: string) {
      assert.equal(table, "turmas");
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { db, filters };
}

test("sem matrícula ou sem turma: estado explícito e sem procurar turma de outro ano", async () => {
  const { db } = fakeSupabase(null);
  assert.deepEqual(await resolveStudentTimetableTurma(db, {
    escolaId: school, anoLetivoId: year, matricula: null,
  }), { turmaId: null, reason: "NO_ENROLLMENT" });
  assert.deepEqual(await resolveStudentTimetableTurma(db, {
    escolaId: school, anoLetivoId: year,
    matricula: { session_id: year, turma_id: null },
  }), { turmaId: null, reason: "NO_CLASS" });
});

test("matrícula de outro ano nunca permite consultar o horário", async () => {
  const { db } = fakeSupabase({ id: clazz, session_id: year });
  await assert.rejects(
    resolveStudentTimetableTurma(db, {
      escolaId: school, anoLetivoId: year,
      matricula: { session_id: otherYear, turma_id: clazz },
    }),
    /matrícula não pertence ao ano letivo/,
  );
});

test("matrícula histórica seleciona somente turma da mesma escola e ano", async () => {
  const { db, filters } = fakeSupabase({ id: clazz, session_id: year });
  const result = await resolveStudentTimetableTurma(db, {
    escolaId: school, anoLetivoId: year,
    matricula: { session_id: year, turma_id: clazz },
  });
  assert.deepEqual(result, { turmaId: clazz, reason: null });
  assert.deepEqual(filters, { id: clazz, escola_id: school, ano_letivo_id: year });
});

test("inconsistência da turma não se converte silenciosamente no horário atual", async () => {
  const missing = fakeSupabase(null);
  await assert.rejects(
    resolveStudentTimetableTurma(missing.db, {
      escolaId: school, anoLetivoId: year,
      matricula: { session_id: year, turma_id: clazz },
    }),
    /turma não pertence ao ano letivo/,
  );
  const wrong = fakeSupabase({ id: clazz, session_id: otherYear });
  await assert.rejects(
    resolveStudentTimetableTurma(wrong.db, {
      escolaId: school, anoLetivoId: year,
      matricula: { session_id: year, turma_id: clazz },
    }),
    /turma não pertence ao ano letivo/,
  );
});

test("erros SQL não se transformam em horário não publicado", async () => {
  const { db } = fakeSupabase(null, new Error("DB_UNAVAILABLE"));
  await assert.rejects(
    resolveStudentTimetableTurma(db, {
      escolaId: school, anoLetivoId: year,
      matricula: { session_id: year, turma_id: clazz },
    }),
    /DB_UNAVAILABLE/,
  );
});

test("contrato HTTP rejeita educando não autorizado e propaga o ano selecionado", async () => {
  const route = await readFile(new URL("../../src/app/api/aluno/horario/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../../src/components/aluno/tabs/TabHorario.tsx", import.meta.url), "utf8");
  assert.match(route, /requestedId && !ctx\.alunoIds\.includes\(requestedId\)/);
  assert.match(route, /resolveBoletimMatricula\(supabase,/);
  assert.match(route, /anoLetivoId: params\.get\("ano_letivo_id"\)/);
  assert.match(route, /resolveStudentTimetableTurma\(supabase,/);
  assert.match(route, /\.eq\("versao_id", versao\.id\)/);
  assert.doesNotMatch(route, /\.in\(['"]status['"],\s*\[['"]ativo/);
  assert.match(ui, /params\.set\("ano_letivo_id", academicYearId\)/);
  assert.match(ui, /\[studentId, academicYearId, horarioRetry, requestKey\]/);
  assert.match(ui, /visibleData\?\.reason === "NO_ENROLLMENT"/);
  assert.match(route, /Cache-Control": "private, no-store"/);
});
