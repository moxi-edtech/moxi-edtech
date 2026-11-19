import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveReceiptAcademicContext } from "../../src/lib/financeiro/receipt-academic-context";

const school = "school-1";
const student = "student-1";
const monthlyId = "monthly-2026";
const enrollment2026 = "enrollment-7th";
const turma2026 = "turma-7th";

type Row = Record<string, unknown>;
function fakeDb(rows: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const query = {
        select(_columns: string) { return query; },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        async maybeSingle() {
          return {
            data: (rows[table] ?? []).find((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value)
            ) ?? null,
            error: null,
          };
        },
      };
      return query;
    },
  };
}

const validRows = (): Record<string, Row[]> => ({
  mensalidades: [{
    id: monthlyId, escola_id: school, aluno_id: student,
    matricula_id: enrollment2026, turma_id: turma2026, ano_letivo: 2026,
  }],
  matriculas: [
    { id: "old-enrollment-6th", escola_id: school, aluno_id: student,
      turma_id: "turma-6th", ano_letivo: 2025, updated_at: "2026-11-16" },
    { id: enrollment2026, escola_id: school, aluno_id: student,
      turma_id: turma2026, ano_letivo: 2026, updated_at: "2026-10-06" },
  ],
  turmas: [{
    id: turma2026, escola_id: school, ano_letivo: 2026,
    nome: "ESG-7ª Classe-T-A", turno: "Tarde",
    classes: { nome: "7ª Classe" }, cursos: { nome: "Ensino Secundário" },
  }],
});

test("receipt for 2026/2027 prints 7th grade even when 2025/2026 enrollment was updated later", async () => {
  const value = await resolveReceiptAcademicContext(fakeDb(validRows()), {
    escolaId: school, alunoId: student, mensalidadeId: monthlyId,
  });
  assert.equal(value?.classeNome, "7ª Classe");
  assert.equal(value?.turmaNome, "ESG-7ª Classe-T-A");
  assert.equal(value?.anoLetivo, 2026);
});

test("receipt academic context is always scoped to the document's school and student", async () => {
  const rows = validRows();
  assert.equal(await resolveReceiptAcademicContext(fakeDb(rows), {
    escolaId: "other-school", alunoId: student, mensalidadeId: monthlyId,
  }), null);
  assert.equal(await resolveReceiptAcademicContext(fakeDb(rows), {
    escolaId: school, alunoId: "other-student", mensalidadeId: monthlyId,
  }), null);
});

test("missing enrollment and inconsistent year or turma fail closed without guessing", async () => {
  const noEnrollment = validRows();
  noEnrollment.mensalidades[0].matricula_id = null;
  assert.equal(await resolveReceiptAcademicContext(fakeDb(noEnrollment), {
    escolaId: school, alunoId: student, mensalidadeId: monthlyId,
  }), null);

  const otherYear = validRows();
  otherYear.mensalidades[0].ano_letivo = 2025;
  assert.equal(await resolveReceiptAcademicContext(fakeDb(otherYear), {
    escolaId: school, alunoId: student, mensalidadeId: monthlyId,
  }), null);

  const differentTurma = validRows();
  differentTurma.mensalidades[0].turma_id = "another-turma";
  assert.equal(await resolveReceiptAcademicContext(fakeDb(differentTurma), {
    escolaId: school, alunoId: student, mensalidadeId: monthlyId,
  }), null);
});

test("print and issuer use the same resolver and never select most recently updated matrícula", () => {
  const src = (path: string) =>
    readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
  const print = src("app/secretaria/documentos/_print/ReciboPrintDocument.tsx");
  const issuer = src("app/api/financeiro/recibos/emitir/route.ts");
  const loader = src("app/secretaria/documentos/_print/getDocumento.ts");
  assert.match(print, /resolveReceiptAcademicContext\(supabase/);
  assert.match(print, /mensalidadeId: doc\.mensalidade_id/);
  assert.match(issuer, /resolveReceiptAcademicContext\(supabase/);
  assert.match(loader, /aluno_id, mensalidade_id, tipo/);
  assert.doesNotMatch(print + issuer, /\.order\("updated_at", \{ ascending: false \}\)/);
});
