import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { listAllAlunos, preselectExportAlunoIds } from "../../src/lib/services/alunos.service";

type RecordRow = Record<string, unknown>;
const escola = "00000000-0000-4000-8000-000000000001";
const outraEscola = "00000000-0000-4000-8000-000000000002";
const sessao = "00000000-0000-4000-8000-000000000011";
const turmaManha = "00000000-0000-4000-8000-000000000021";
const turmaTarde = "00000000-0000-4000-8000-000000000022";
const classe = "00000000-0000-4000-8000-000000000031";
const outraClasse = "00000000-0000-4000-8000-000000000032";

const matriculas = [
  { escola_id: escola, session_id: sessao, ano_letivo: 2026, aluno_id: "aluno1", turma_id: turmaManha, bolsa_integral: true, bolsa_parcial_percentagem: 0, status: "ativa" },
  { escola_id: escola, session_id: sessao, ano_letivo: 2026, aluno_id: "aluno2", turma_id: turmaTarde, bolsa_integral: false, bolsa_parcial_percentagem: 0, status: "ativa" },
  { escola_id: escola, session_id: sessao, ano_letivo: 2026, aluno_id: "aluno3", turma_id: turmaManha, bolsa_integral: false, bolsa_parcial_percentagem: 0, status: "inativa" },
  { escola_id: outraEscola, session_id: sessao, ano_letivo: 2026, aluno_id: "intruso", turma_id: turmaManha, bolsa_integral: true, bolsa_parcial_percentagem: 0, status: "ativa" },
  { escola_id: escola, session_id: sessao, ano_letivo: 2025, aluno_id: "alunoAntigo", turma_id: turmaManha, bolsa_integral: true, bolsa_parcial_percentagem: 0, status: "ativa" },
];
const turmas = [
  { id: turmaManha, escola_id: escola, session_id: sessao, ano_letivo: 2026, classe_id: classe, turno: "M", nome: "A" },
  { id: turmaTarde, escola_id: escola, session_id: sessao, ano_letivo: 2026, classe_id: outraClasse, turno: "T", nome: "B" },
  { id: "turmaOutra", escola_id: outraEscola, session_id: sessao, ano_letivo: 2026, classe_id: classe, turno: "M" },
];

function createFixture() {
  const calls: Array<{ table: string; filters: string[] }> = [];
  const records: Record<string, RecordRow[]> = {
    anos_letivos: [{ id: sessao, escola_id: escola, ano: 2026, ativo: true }],
    matriculas, turmas, alunos: [], vw_secretaria_alunos_resumo: [], mensalidades: [],
  };
  class Query {
    private filters: Array<(row: RecordRow) => boolean> = [];
    private descriptions: string[] = [];
    private first = 0;
    private last = 999;
    constructor(private table: string) {}
    select(_columns: string) { return this; }
    eq(col: string, val: unknown) {
      this.filters.push(row => row[col] === val); this.descriptions.push(`${col}=${String(val)}`); return this;
    }
    or(expression: string) {
      // Interpret the PostgREST predicates used by the service, never return an
      // unfiltered result for an unsupported expression.
      const predicates = expression.split(",").map(part => {
        const [col, op, value] = part.split(".");
        if (op === "eq" && (value === "true" || value === "false"))
          return (row: RecordRow) => row[col] === (value === "true");
        if (op === "gt" && /^\d+$/.test(value))
          return (row: RecordRow) => typeof row[col] === "number" && Number(row[col]) > Number(value);
        throw new Error("Unsupported fixture filter: " + part);
      });
      this.filters.push(row => predicates.some(predicate => predicate(row)));
      this.descriptions.push("or:" + expression);
      return this;
    }
    in(col: string, vals: unknown[]) {
      this.filters.push(row => vals.includes(row[col])); this.descriptions.push(`${col} IN`); return this;
    }
    order(_col: string, _opts?: unknown) { return this; }
    limit(n: number) { this.last = this.first + n - 1; return this; }
    range(first: number, last: number) { this.first = first; this.last = last; return this; }
    private result() {
      calls.push({ table: this.table, filters: [...this.descriptions] });
      return { data: (records[this.table] ?? []).filter(row => this.filters.every(p => p(row))).slice(this.first, this.last + 1), error: null };
    }
    async maybeSingle() { const result = this.result(); return { data: result.data[0] ?? null, error: null }; }
    then<TResult1 = { data: RecordRow[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: RecordRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) { return Promise.resolve(this.result()).then(onfulfilled, onrejected); }
  }
  const client = { from: (table: string) => new Query(table) };
  return { client: client as any, calls, records };
}

test("exportação geral não introduz consultas adicionais nem muda semântica", async () => {
  const { client, calls } = createFixture();
  assert.equal(await preselectExportAlunoIds(client, escola, {}), null);
  assert.equal(calls.length, 0);
});

test("pré-seleção de turma, classe, turno, ano e bolsa não mistura escolas nem matrícula inativa", async () => {
  const { client, calls } = createFixture();
  const ids = await preselectExportAlunoIds(
    client, escola, { classeId: classe, turno: "manha", bolsa: "sim" },
    { academicYearId: sessao },
  );
  assert.deepEqual([...ids ?? []], ["aluno1"]);
  assert.ok(calls.every(c => c.filters.some(f => f === `escola_id=${escola}`)));
  assert.ok(calls.some(c => c.table === "turmas"));
  assert.ok(calls.some(c => c.table === "matriculas"));

  const naoBolseiros = await preselectExportAlunoIds(client, escola, { bolsa: "nao" });
  assert.deepEqual([...naoBolseiros ?? []], ["aluno2"]);
  const turmasContraditorias = await preselectExportAlunoIds(
    client, escola, { turmaId: turmaTarde, classeId: classe, turno: "manha" });
  assert.deepEqual([...turmasContraditorias ?? []], []);
  const anoErrado = await preselectExportAlunoIds(client, escola, { turmaId: turmaManha, ano: 2024 });
  assert.deepEqual([...anoErrado ?? []], []);
});

test("bolsas parciais entram nos bolseiros e não entram nos não bolseiros", async () => {
  const { client, calls, records } = createFixture();
  records.matriculas = [
    ...records.matriculas,
    { escola_id: escola, session_id: sessao, ano_letivo: 2026, aluno_id: "parcial", turma_id: turmaManha, bolsa_integral: false, bolsa_parcial_percentagem: 50, status: "ativa" },
    { escola_id: outraEscola, session_id: sessao, ano_letivo: 2026, aluno_id: "parcialExterno", turma_id: turmaManha, bolsa_integral: false, bolsa_parcial_percentagem: 25, status: "ativa" },
    { escola_id: escola, session_id: sessao, ano_letivo: 2026, aluno_id: "parcialInativo", turma_id: turmaManha, bolsa_integral: false, bolsa_parcial_percentagem: 75, status: "inativa" },
  ];
  const ids = await preselectExportAlunoIds(client, escola, { bolsa: "sim", classeId: classe, turno: "manha" }, { academicYearId: sessao });
  assert.deepEqual([...ids ?? []].sort(), ["aluno1", "parcial"]);
  const naoBolseiros = await preselectExportAlunoIds(client, escola, { bolsa: "nao" });
  assert.deepEqual([...naoBolseiros ?? []], ["aluno2"]);
  assert.ok(calls.every(c => c.filters.includes(`escola_id=${escola}`)));
  assert.ok(calls.some(c => c.filters.includes("or:bolsa_integral.eq.true,bolsa_parcial_percentagem.gt.0")));
});

test("camada de exportação filtra antes das consultas pesadas sem cortar o último lote", async () => {
  const { client, calls, records } = createFixture();
  const pages = Array.from({ length: 110 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 24, 0, 0, 0) - i * 60_000).toISOString();
    return { id: i === 55 ? "aluno1" : `outro${i}`, aluno_id: i === 55 ? "aluno1" : `outro${i}`, origem: "aluno", nome: `Aluno ${i}`, created_at: d, status: "ativo" };
  });
  records.alunos = [{ id: "aluno1", escola_id: escola, responsavel: "Responsável" }];
  const originalFrom = client.from.bind(client);
  let rpcCalls = 0;
  client.rpc = async (name: string, args: Record<string, unknown>) => {
    assert.equal(name, "secretaria_list_alunos_kf2");
    assert.equal(args.p_escola_id, escola);
    rpcCalls++;
    const start = args.p_cursor_id ? pages.findIndex(r => r.id === args.p_cursor_id) + 1 : 0;
    return { data: pages.slice(start, start + Number(args.p_limit)), error: null };
  };
  // O falso cliente de base continua a fornecer os resultados por escola.
  client.from = originalFrom;

  const result = await listAllAlunos(client, escola, { turmaId: turmaManha, bolsa: "sim", status: "active" }, {
    includeFinanceiro: true, includeResumo: true, academicYearId: sessao,
  });
  assert.deepEqual(result.map(x => x.id), ["aluno1"]);
  assert.equal(rpcCalls, 3);
  assert.equal(calls.filter(c => c.table === "mensalidades").length, 1);
  assert.ok(calls.every(c => c.table === "anos_letivos" || c.filters.some(f => f === `escola_id=${escola}`) ||
    c.table === "vw_secretaria_alunos_resumo"));
});

test("erros de filtros têm resposta acionável sem expor mensagens SQL no navegador", () => {
  const admin = readFileSync(new URL("../../src/components/escola-admin/AlunosListClient.tsx", import.meta.url), "utf8");
  const secretaria = readFileSync(new URL("../../src/components/secretaria/AlunosSecretariaPage.tsx", import.meta.url), "utf8");
  const context = readFileSync(new URL("../../src/lib/services/alunosExportPdfContext.server.ts", import.meta.url), "utf8");
  const download = readFileSync(new URL("../../src/lib/services/alunosExportDownload.client.ts", import.meta.url), "utf8");
  for (const client of [admin, secretaria]) assert.match(client, /await downloadAlunosExport\(/);
  assert.match(download, /response\.json\(\)\.catch/);
  assert.match(download, /response\.status === 400 && typeof body\?\.error === "string"/);
  assert.match(download, /response\.status === 504/);
  assert.match(download, /content-type/);
  assert.equal((download.match(/throw new Error\(body\.error\)/g) ?? []).length, 1);
  assert.doesNotMatch(secretaria, /window\.open\(\`\/api\/secretaria\/alunos\/exportar/);
  assert.match(context, /new InvalidAlunoFiltersError/);
});
