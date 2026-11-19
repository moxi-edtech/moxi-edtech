import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyMatricula, selectMatriculasDaLista } from "../../src/lib/documentos/listaNominalPolicy";
import { normalizarEstadoMatricula } from "../../src/lib/matriculas/student-lifecycle";
import { canConfirmarDesistencia, DESISTENCIA_CONFIRMACAO_PAPEIS } from "../../src/lib/matriculas/desistencia-permissions";

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
  assert.match(migration, /AS RESTRICTIVE FOR INSERT TO authenticated/);
  assert.match(migration, /AS RESTRICTIVE FOR UPDATE TO authenticated/);
  assert.match(migration, /WITH CHECK \(status <> 'desistente'\)/);
  assert.match(migration, /DROP POLICY IF EXISTS matriculas_desistencia_update_rpc_only/);
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

test("ocupação usa matrículas ativas da sessão, sem materialized view desatualizada", () => {
  const details = source("app/api/secretaria/turmas/[id]/detalhes/route.ts");
  assert.match(details, /count: 'exact', head: true/);
  assert.match(details, /\.eq\('session_id', turmaResult\.session_id\)/);
  assert.match(details, /\.eq\('ativo', true\)/);
  assert.match(details, /\.in\('status', ACTIVE_MATRICULA_STATUSES\)/);
  assert.doesNotMatch(details, /from\('vw_turmas_para_matricula'\)/);
  assert.match(details, /const ocupacaoFinal = ocupacao \?\? 0/);
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

test("as rotas reais de Operações usam a lista e o dossiê com a ação", () => {
  const turmaRoute = source("app/escola/[id]/(portal)/operacoes/turmas/[turmaId]/page.tsx");
  const alunoRoute = source("app/escola/[id]/(portal)/operacoes/alunos/[alunoId]/page.tsx");
  const turmaAdmin = source("app/escola/[id]/(portal)/admin/turmas/[turmaId]/page.tsx");
  const alunoAdmin = source("app/escola/[id]/(portal)/admin/alunos/[alunoId]/page.tsx");
  const turmaClient = source("components/secretaria/TurmaDetailClient.tsx");
  const perfil = source("components/aluno/AlunoPerfilPage.tsx");

  assert.match(turmaRoute, /admin\/turmas\/\[turmaId\]\/page/);
  assert.match(alunoRoute, /admin\/alunos\/\[alunoId\]\/page/);
  assert.match(turmaAdmin, /<TurmaDetailClient/);
  assert.match(alunoAdmin, /<AlunoPerfilPage/);
  assert.match(turmaClient, /<DesistenciaMatriculaAction/);
  assert.match(turmaClient, /canManageDesistencia=\{data\?\.canManageDesistencia === true\}/);
  assert.match(turmaClient, /alunoId=\{aluno\.aluno_id\}/);
  assert.match(turmaClient, /matriculaId=\{aluno\.matricula_id\}/);
  assert.match(perfil, /<CurrentYearEnrollmentPanel/);
  assert.match(perfil, /canManageDesistencia=\{canManageDesistencia\}/);
  assert.match(perfil, /canConfirmarDesistencia\(member\?\.papel\)/);
  assert.doesNotMatch(perfil, /canManageDesistencia=\{role === "admin"/);
});

test("Operações respeita a permissão do DB e não confunde URL com autorização", () => {
  const details = source("app/api/secretaria/turmas/[id]/detalhes/route.ts");
  assert.match(details, /\.from\('escola_users'\)/);
  assert.match(details, /\.eq\('escola_id', escolaId\)/);
  assert.match(details, /\.eq\('user_id', user\.id\)/);
  assert.match(details, /canConfirmarDesistencia\(member\?\.papel\)/);
  assert.match(details, /canManageDesistencia,/);
  for (const role of ["diretor", "admin", "admin_escola", "staff_admin", "admin_secretaria", "secretaria", "secretaria_financeiro", "admin_financeiro"]) {
    assert.equal(canConfirmarDesistencia(role), true, role);
    assert.ok(DESISTENCIA_CONFIRMACAO_PAPEIS.includes(role as never));
  }
  for (const role of ["professor", "aluno", "financeiro", "formador", null, undefined]) {
    assert.equal(canConfirmarDesistencia(role), false, String(role));
  }
});


const reversalMigration = readFileSync(
  new URL("../../../../supabase/migrations/20271119093000_matricula_desistencia_reativacao_v2.sql", import.meta.url),
  "utf8",
);

test("reativação restaura a mesma matrícula sem apagar o histórico", () => {
  assert.match(reversalMigration, /CREATE OR REPLACE FUNCTION public\.reativar_matricula_desistente/);
  assert.match(reversalMigration, /SELECT \* INTO v_m FROM public\.matriculas WHERE id=p_matricula_id FOR UPDATE/);
  assert.match(reversalMigration, /v_m\.status <> 'desistente' OR v_m\.ativo IS DISTINCT FROM FALSE/);
  assert.match(reversalMigration, /al\.ativo IS TRUE/);
  assert.match(reversalMigration, /ha\.snapshot_status='fechado'/);
  assert.match(reversalMigration, /FOR UPDATE;/);
  assert.match(reversalMigration, /v_occupied >= v_t\.capacidade_maxima/);
  assert.match(reversalMigration, /REATIVACAO_MATRICULA_DUPLICADA/);
  assert.match(reversalMigration, /INSERT INTO public\.matricula_desistencia_reativacoes/);
  assert.match(reversalMigration, /motivo_desistencia_anterior,data_desistencia_anterior/);
  assert.match(reversalMigration, /status='ativo', ativo=true, motivo_fecho=NULL, data_fecho=NULL/);
  assert.match(reversalMigration, /status_fecho_origem=NULL, updated_by=v_user/);
  assert.doesNotMatch(reversalMigration, /DELETE\s+FROM\s+public\.(?:matriculas|alunos|notas|mensalidades)/i);
  assert.doesNotMatch(reversalMigration, /UPDATE\s+public\.(?:notas|mensalidades|historico_anos|alunos)\s+SET/i);
});

test("não é possível reativar diretamente via UPDATE nem cruzar polo", () => {
  assert.match(reversalMigration, /AS RESTRICTIVE FOR UPDATE TO authenticated/);
  assert.match(reversalMigration, /USING \(status <> 'desistente'\)/);
  assert.match(reversalMigration, /WITH CHECK \(status <> 'desistente'\)/);
  assert.match(reversalMigration, /cc_security\.allowed_turma\(v_m\.escola_id,v_m\.turma_id,v_m\.ano_letivo\)/);
  assert.match(reversalMigration, /REVOKE ALL ON FUNCTION public\.reativar_matricula_desistente\(uuid,text\) FROM PUBLIC,anon/);
  assert.match(reversalMigration, /GRANT EXECUTE ON FUNCTION public\.reativar_matricula_desistente\(uuid,text\) TO authenticated/);
  assert.match(reversalMigration, /matricula_desistencia_reativacoes ENABLE ROW LEVEL SECURITY/);
  assert.match(reversalMigration, /public\.user_has_role_in_school\(escola_id/);
});

test("API e perfil devolvem estado de desistência e a reativação via RPC", () => {
  const api = source("app/api/matriculas/desistencia/route.ts");
  const corrente = source("app/api/secretaria/alunos/[id]/matricula-corrente/route.ts");
  const panel = source("components/aluno/CurrentYearEnrollmentPanel.tsx");
  const action = source("components/matriculas/DesistenciaMatriculaAction.tsx");
  assert.match(api, /acao: z\.literal\("reativar"\)/);
  assert.match(api, /reativar_matricula_desistente/);
  assert.match(api, /estado: z\.enum\(\["ativo", "desistente"\]\)/);
  assert.match(corrente, /result\.desistencia = \{/);
  assert.match(corrente, /\.eq\("status", "desistente"\)\.eq\("ativo", false\)/);
  assert.match(panel, /tipo="reativar"/);
  assert.match(panel, /Desistente neste ano letivo/);
  assert.match(panel, /state\.desistencia\.matriculaId/);
  assert.match(action, /variant\?: "button" \| "menu"/);
  assert.match(action, /createPortal\(/);
});

test("lista compacta localiza desistentes, oferece menu e recarrega estado real", () => {
  const turma = source("components/secretaria/TurmaDetailClient.tsx");
  const details = source("app/api/secretaria/turmas/[id]/detalhes/route.ts");
  assert.match(turma, /estadoFilter/);
  assert.match(turma, /Desistentes \(\{desistentes\.length\}\)/);
  assert.match(turma, /popover="auto"/);
  assert.match(turma, /tipo=\{aluno\.status_matricula === "desistente" \? "reativar" : "confirmar"\}/);
  assert.match(turma, /setRosterRevision\(\(previous\) => previous \+ 1\)/);
  assert.match(details, /\.in\('status', \[\.\.\.ACTIVE_MATRICULA_STATUSES, 'desistente'\]\)/);
  assert.match(details, /desistentes: alunosDesistentes/);
  assert.match(details, /alunos: alunosAtivos/);
  assert.match(details, /count: 'exact', head: true/);
});
