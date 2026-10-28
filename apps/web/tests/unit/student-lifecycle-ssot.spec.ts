import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  construirCicloVidaAluno,
  normalizarEstadoMatricula,
  type MatriculaLifecycleInput,
  type HistoricoLifecycleInput,
} from "../../src/lib/matriculas/student-lifecycle";

const aluno = "11111111-1111-4111-8111-111111111111";
const escola = "22222222-2222-4222-8222-222222222222";
const origemId = "33333333-3333-4333-8333-333333333333";
const destinoId = "44444444-4444-4444-8444-444444444444";

function matricula(overrides: Partial<MatriculaLifecycleInput> = {}): MatriculaLifecycleInput {
  return {
    id: origemId, escola_id: escola, aluno_id: aluno, ano_letivo: 2025,
    status: "pendente", ativo: false, turma_id: "55555555-5555-4555-8555-555555555555",
    origem_transicao_matricula_id: null, ...overrides,
  };
}
function historico(overrides: Partial<HistoricoLifecycleInput> = {}): HistoricoLifecycleInput {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    matricula_id: origemId, escola_id: escola, aluno_id: aluno,
    ano_letivo: 2025, resultado_final: "aprovado", snapshot_status: "aberto",
    ...overrides,
  };
}

test("2025 pendente with destination active 2026 is flagged without assuming approval", () => {
  const output = construirCicloVidaAluno([
    matricula(),
    matricula({
      id: destinoId, ano_letivo: 2026, status: "ativo", ativo: true,
      origem_transicao_matricula_id: origemId,
    }),
  ], []);
  assert.equal(output.matriculaCorrente?.matriculaId, destinoId);
  assert.equal(output.matriculaCorrente?.estadoOperacional, "ativa");
  const origem = output.matriculas.find((m) => m.matriculaId === origemId)!;
  assert.equal(origem.estadoOperacional, "pendente");
  assert.equal(origem.academico.resultadoOficial, null);
  assert.ok(origem.pendencias.some((p) => p.codigo === "ORIGEM_PENDENTE_COM_DESTINO_ATIVO"));
});

test("recorded approval is not official before legal snapshot is closed", () => {
  const open = construirCicloVidaAluno([matricula({ status: "concluido" })], [historico()]);
  assert.equal(open.matriculaCorrente?.academico.resultadoRegistrado, "aprovado");
  assert.equal(open.matriculaCorrente?.academico.resultadoOficial, null);
  assert.ok(open.matriculaCorrente?.pendencias.some((p) => p.codigo === "HISTORICO_EM_CONSTRUCAO"));
  const closed = construirCicloVidaAluno([matricula({ status: "concluido" })], [historico({ snapshot_status: "fechado" })]);
  assert.equal(closed.matriculaCorrente?.academico.resultadoOficial, "aprovado");
  assert.equal(closed.matriculaCorrente?.proximaAcao, "consultar_historico");
});

test("transfer and reprobation are never synonymous with annual academic result", () => {
  const moved = construirCicloVidaAluno([matricula({ status: "transferido", ativo: false })], []);
  assert.equal(moved.matriculaCorrente?.estadoOperacional, "encerrada");
  assert.equal(moved.matriculaCorrente?.academico.resultadoOficial, null);
  assert.equal(normalizarEstadoMatricula("reprovado", false), "encerrada");
  assert.equal(normalizarEstadoMatricula("reprovado_por_faltas", false), "encerrada");
});

test("activation flag and status must agree; never hide legacy divergence", () => {
  assert.equal(normalizarEstadoMatricula("ativo", false), "revisao");
  assert.equal(normalizarEstadoMatricula("pendente", true), "revisao");
  assert.equal(normalizarEstadoMatricula("active", true), "ativa");
  assert.equal(normalizarEstadoMatricula("pendente", false), "pendente");
  const cycle = construirCicloVidaAluno([matricula({ status: "ativo", ativo: false })], []);
  assert.equal(cycle.matriculaCorrente?.proximaAcao, "rever_integridade");
});

test("duplicate active matriculas and invalid source year are explicitly flagged", () => {
  const cycle = construirCicloVidaAluno([
    matricula({ status: "ativo", ativo: true, ano_letivo: 2026 }),
    matricula({ id: destinoId, ano_letivo: 2026, status: "ativo", ativo: true, origem_transicao_matricula_id: origemId }),
  ], []);
  for (const row of cycle.matriculas) {
    assert.ok(row.pendencias.some((p) => p.codigo === "ATIVAS_DUPLICADAS_NO_ANO"));
  }
  assert.ok(cycle.matriculas.find((x) => x.matriculaId === destinoId)?.pendencias
    .some((x) => x.codigo === "ORIGEM_INCOMPATIVEL"));
});

test("unlinked historical results remain orphaned rather than linked by year or name", () => {
  const cycle = construirCicloVidaAluno([matricula()], [historico({ matricula_id: null })]);
  assert.equal(cycle.matriculaCorrente?.academico.resultadoRegistrado, "pendente");
  assert.equal(cycle.pendenciasGerais[0]?.codigo, "HISTORICO_SEM_VINCULO");
});

test("route consumers import the canonical lifecycle without writing enrollment statuses", () => {
  const files = [
    "app/api/secretaria/alunos/[id]/lifecycle/route.ts",
    "app/api/secretaria/alunos/[id]/dossier/route.ts",
    "app/api/secretaria/alunos/[id]/timeline-360/route.ts",
    "app/api/secretaria/alunos/[id]/matricula-corrente/route.ts",
    "app/api/aluno/home/status/route.ts",
    "app/api/aluno/rematricula/status/route.ts",
    "app/api/secretaria/balcao/rematriculas/status/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");
    assert.match(source, /carregarCicloVidaAluno/, file);
  }
  const readOnlyRoute = readFileSync(new URL("../../src/app/api/secretaria/alunos/[id]/lifecycle/route.ts", import.meta.url), "utf8");
  assert.match(readOnlyRoute, /requireRoleInSchool/);
  assert.match(readOnlyRoute, /resolveEscolaIdForUser/);
  assert.doesNotMatch(readOnlyRoute, /export async function POST|export async function PATCH|export async function PUT/);
});

test("active enrollment duplication is scoped to school + student + year", () => {
  const differentStudent = "77777777-7777-4777-8777-777777777777";
  const cycle = construirCicloVidaAluno([
    matricula({ status: "ativo", ativo: true, ano_letivo: 2026 }),
    matricula({ id: destinoId, aluno_id: differentStudent, status: "ativo", ativo: true, ano_letivo: 2026 }),
  ], []);
  assert.equal(cycle.matriculas.filter((entry) =>
    entry.pendencias.some((issue) => issue.codigo === "ATIVAS_DUPLICADAS_NO_ANO"),
  ).length, 0);
});

test("legacy enrollment status cannot overwrite academic decisions by changing one column", () => {
  const source = readFileSync(
    new URL("../../src/app/api/secretaria/matriculas/[matriculaId]/status/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /LIFECYCLE_CANONICAL_FLOW_REQUIRED/);
  assert.match(source, /requireRoleInSchool/);
  assert.match(source, /normalizarEstadoMatricula/);
  assert.doesNotMatch(source, /\.update\(/);
  const alias = readFileSync(
    new URL("../../src/app/api/secretaria/admissoes/matriculas/[matriculaId]/status/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(alias, /export \{ PUT \}/);
});


test("a closed snapshot without legal lock is not an official result", () => {
  const base = [matricula({ status: "concluido", ativo: false })];
  const registered = [historico({ snapshot_status: "fechado", resultado_final: "aprovado" })];
  const withoutLock = construirCicloVidaAluno(base, registered, new Map([[origemId, null]]));
  assert.equal(withoutLock.matriculaCorrente?.academico.resultadoRegistrado, "aprovado");
  assert.equal(withoutLock.matriculaCorrente?.academico.resultadoOficial, null);
  assert.equal(withoutLock.matriculaCorrente?.proximaAcao, "validar_resultado");
  const withLock = construirCicloVidaAluno(base, registered, new Map([[origemId, "aprovado"]]));
  assert.equal(withLock.matriculaCorrente?.academico.resultadoOficial, "aprovado");
});

test("all school lifecycle APIs consume the database security-invoker SSOT view", () => {
  const loader = readFileSync(
    new URL("../../src/lib/matriculas/load-student-lifecycle.ts", import.meta.url), "utf8",
  );
  assert.match(loader, /\.from\("v_student_lifecycle_ssot_v1"\)/);
  assert.match(loader, /resultado_oficial/);
  assert.match(loader, /normalizarEstadoMatricula/);
  assert.match(loader, /"historico_anos"/);
  const viewMigration = readFileSync(
    new URL("../../../../supabase/migrations/20261028211533_lifecycle_history_ssot_view_20261028.sql", import.meta.url),
    "utf8",
  );
  assert.match(viewMigration, /security_invoker=true/);
  assert.match(viewMigration, /historico_snapshot_locks/);
  assert.match(viewMigration, /status='fechado'/);
});


test("legacy selective rematriculation cannot bypass canonical RAA or move an unselected student", () => {
  const route = readFileSync(
    new URL("../../src/app/api/secretaria/rematricula/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /LIFECYCLE_CANONICAL_RAA_REQUIRED/);
  assert.match(route, /status: 409/);
  assert.doesNotMatch(route, /\.insert\(newMatriculas\)|\.update\(\{ status: 'transferido' \}\)/);
  assert.doesNotMatch(route, /rpc\('rematricula_em_massa'/);
});

test("bulk terminal-class closing invokes GradeEngine writer per enrollment", () => {
  const route = readFileSync(
    new URL("../../src/app/api/secretaria/rematricula/confirmar/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /rpc\('finalizar_matricula_blindada'/);
  assert.match(route, /conclusoes: resultsConclusoes/);
  assert.match(route, /p_is_override_manual: false/);
  assert.doesNotMatch(route, /\.update\(\{ status: 'concluido' \}\)/);
  const page = readFileSync(
    new URL("../../src/app/secretaria/(portal-secretaria)/rematricula/confirmar/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /summary\.conclusoes/);
  assert.match(page, /Rever no Balcão/);
});
