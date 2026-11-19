import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyMatricula, selectMatriculasDaLista } from "../../src/lib/documentos/listaNominalPolicy";
import { normalizarEstadoMatricula } from "../../src/lib/matriculas/student-lifecycle";

const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../../supabase/migrations/20271119090000_matricula_desistencia_operacional_v1.sql", import.meta.url),
  "utf8",
);

test("Desistente existe no contrato do DB, não é nota, resultado académico nem eliminação", () => {
  assert.match(migration, /status='desistente', ativo=false/);
  assert.match(migration, /motivo_fecho=v_reason/);
  assert.match(migration, /data_fecho=now\(\)/);
  assert.match(migration, /status_fecho_origem='manual'/);
  assert.match(migration, /trg_matriculas_status_audit/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.(?:matriculas|alunos|notas|mensalidades)/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.(?:notas|frequencias|mensalidades|historico_anos|alunos)\s+SET/i);
  assert.equal(normalizarEstadoMatricula("desistente", false), "cancelada");
  assert.equal(normalizarEstadoMatricula("desistente", true), "revisao");
});

test("processo exige motivo, matrícula ativa, ano corrente e histórico não fechado", () => {
  assert.match(migration, /length\(v_reason\) NOT BETWEEN 10 AND 500/);
  assert.match(migration, /SELECT \* INTO v_m FROM public\.matriculas WHERE id=p_matricula_id FOR UPDATE/);
  assert.match(migration, /v_m\.status <> 'ativo' OR v_m\.ativo IS DISTINCT FROM TRUE/);
  assert.match(migration, /al\.ativo IS TRUE/);
  assert.match(migration, /ha\.snapshot_status='fechado'/);
  assert.match(migration, /v_m\.status='desistente' AND v_m\.ativo IS FALSE/);
  assert.match(migration, /DESISTENCIA_CONFLITO_CONCORRENTE/);
});

test("somente funções autenticadas; professor não encerra, só sinaliza turma atribuída", () => {
  assert.match(migration, /ALTER TABLE public\.matricula_desistencia_sinalizacoes ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.matricula_desistencia_sinalizacoes FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.registar_desistencia_matricula\(uuid,text\) FROM PUBLIC,anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.registar_desistencia_matricula\(uuid,text\) TO authenticated/);
  const confirm = migration.split("CREATE OR REPLACE FUNCTION public.registar_desistencia_matricula")[1].split("CREATE OR REPLACE FUNCTION public.sinalizar_desistencia_matricula")[0];
  assert.doesNotMatch(confirm, /'professor'/);
  const teacher = migration.split("CREATE OR REPLACE FUNCTION public.sinalizar_desistencia_matricula")[1].split("CREATE OR REPLACE FUNCTION public.descartar_sinalizacao_desistencia")[0];
  assert.match(teacher, /FROM public\.turma_disciplinas_professores tdp/);
  assert.match(teacher, /FROM public\.turma_disciplinas td/);
  assert.match(teacher, /tdp\.professor_id=v_professor_id/);
  assert.match(teacher, /td\.professor_id=v_professor_id/);
  assert.match(teacher, /FROM public\.escola_users eu/);
  assert.match(teacher, /eu\.escola_id=v_m\.escola_id AND eu\.user_id=v_user/);
  assert.match(migration, /eu\.escola_id = matricula_desistencia_sinalizacoes\.escola_id/);
  assert.match(migration, /SINALIZACAO_JA_CONFIRMADA/);
  assert.doesNotMatch(teacher, /UPDATE public\.matriculas SET/);
  assert.match(migration, /uq_sinalizacao_desistencia_pendente/);
});

test("desistentes não ocupam vaga, permanecem identificáveis na lista histórica", () => {
  assert.equal(classifyMatricula("desistente"), "desistente");
  const rows = [
    { status: "ativo", ativo: true, matriculaId: "a" },
    { status: "desistente", ativo: false, matriculaId: "b" },
    { status: "transferido", ativo: false, matriculaId: "c" },
  ];
  assert.deepEqual(selectMatriculasDaLista(rows, "operacional").incluidos.map((r) => r.matriculaId), ["a"]);
  assert.deepEqual(selectMatriculasDaLista(rows, "ano_letivo").incluidos.map((r) => r.matriculaId), ["a", "b", "c"]);
  assert.equal(selectMatriculasDaLista(rows, "operacional").excluidos.desistente, 1);
  assert.deepEqual(selectMatriculasDaLista(rows, "operacional", true).incluidos, rows);
  assert.match(source("lib/documentos/listaNominalPdf.ts"), /desistente: "Desistente"/);
});

test("API aplica papel de escola e RPC, nunca altera matrícula diretamente", () => {
  const api = source("app/api/matriculas/desistencia/route.ts");
  assert.match(api, /resolveEscolaIdForUser/);
  assert.match(api, /requireRoleInSchool/);
  assert.match(api, /registar_desistencia_matricula/);
  assert.match(api, /sinalizar_desistencia_matricula/);
  assert.match(api, /descartar_sinalizacao_desistencia/);
  assert.doesNotMatch(api, /\.from\("matriculas"\)\.update/);
  assert.match(api, /Cache-Control.*private, no-store/);
});

test("as quatro interfaces reutilizam a mesma ação e as permissões próprias", () => {
  const action = source("components/matriculas/DesistenciaMatriculaAction.tsx");
  const turma = source("components/secretaria/TurmaDetailClient.tsx");
  const operacoes = source("components/secretaria/command-center/TurmaContextView.tsx");
  const professor = source("app/professor/frequencias/page.tsx");
  const perfil = source("components/aluno/CurrentYearEnrollmentPanel.tsx");
  const fetchProfessor = source("app/api/professor/turmas/[id]/alunos/route.ts");
  assert.match(action, /tipo: "confirmar" \| "sinalizar"/);
  assert.match(action, /Confirmar desistência/);
  assert.match(action, /Sinalização enviada à Secretaria/);
  assert.match(turma, /<DesistenciaMatriculaAction/);
  assert.match(operacoes, /<DesistenciaMatriculaAction/);
  assert.match(professor, /tipo="sinalizar"/);
  assert.match(perfil, /canManageDesistencia/);
  assert.match(fetchProfessor, /matricula_id: row\.id/);
  assert.match(fetchProfessor, /\.eq\("ativo", true\)/);
});
