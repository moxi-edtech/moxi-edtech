import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isAcaoMatriculaContextual, isSituacaoMatriculaContextual,
  rotuloSituacaoMatricula, textoResultadoAcademico,
} from "../../src/lib/matriculas/lifecycle-status-contract";

const root = new URL("../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("contextual statuses never infer student approval from enrollment", () => {
  assert.equal(rotuloSituacaoMatricula("regularizacao_historica"), "Histórico anterior por regularizar");
  assert.equal(textoResultadoAcademico("sem_resultado_oficial", null), "Resultado académico ainda não oficializado");
  assert.equal(isSituacaoMatriculaContextual("indefinido"), false);
  assert.equal(isSituacaoMatriculaContextual("reprovado"), false);
  assert.equal(isAcaoMatriculaContextual("conciliar_historico"), true);
});

test("read-only projection is invoker scoped, disambiguates historical pending, gates official result", () => {
  const sql = read("supabase/migrations/20271029110000_lifecycle_contextual_status_ssot_v2.sql");
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /v_student_lifecycle_ssot_v1/);
  assert.match(sql, /ano_superado_pelo_ativo OR possui_matricula_posterior/);
  assert.match(sql, /'regularizacao_historica'/);
  assert.match(sql, /resultado_oficial IN \('aprovado','reprovado','concluido'\)/);
  assert.match(sql, /REVOKE ALL.*PUBLIC, anon/);
  assert.doesNotMatch(sql, /UPDATE public\.matriculas|INSERT INTO public\.notas|UPDATE public\.historico_anos/i);
});

test("secretaria, student portal, command center, explorers and export share one view", () => {
  const loader = read("apps/web/src/lib/matriculas/load-student-lifecycle.ts");
  const roster = read("apps/web/src/lib/command-center/roster-lifecycle.ts");
  const command = read("apps/web/src/app/api/escolas/[id]/command-center/roster/route.ts");
  const exportRoute = read("apps/web/src/app/api/escolas/[id]/command-center/roster/export/route.ts");
  const student = read("apps/web/src/app/api/aluno/home/status/route.ts");
  const panel = read("apps/web/src/components/aluno/CurrentYearEnrollmentPanel.tsx");
  assert.match(loader, /v_student_lifecycle_status_v2/);
  assert.match(roster, /v_student_lifecycle_status_v2/);
  assert.match(command, /carregarSituacoesRoster/);
  assert.match(exportRoute, /carregarSituacoesRoster/);
  assert.match(student, /rotuloSituacaoMatricula/);
  assert.match(panel, /regularizacao_historica/);
  for (const name of ["ClasseContextView", "TurmaContextView"]) {
    assert.match(read(`apps/web/src/components/secretaria/command-center/${name}.tsx`), /rotuloSituacaoMatricula/);
  }
});
