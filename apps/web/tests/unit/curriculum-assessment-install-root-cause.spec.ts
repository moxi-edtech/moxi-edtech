import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = existsSync(resolve(process.cwd(), 'apps/web'))
  ? process.cwd()
  : resolve(process.cwd(), '../..');
const source = (file: string) => readFileSync(resolve(root, file), 'utf8');

test('instalação de disciplinas filtra escola, ano UUID, curso, classe e matriz publicada', () => {
  const src = source('apps/web/src/lib/academico/curriculum-apply.ts');
  const sync = src.slice(src.indexOf('async function syncTurmaDisciplinasFromMatriz('),
    src.indexOf('async function createCurriculoDraft('));
  assert.match(sync, /\.eq\("escola_id", escolaId\)/);
  assert.match(sync, /\.eq\("ano_letivo_id", anoLetivoId\)/);
  assert.match(sync, /\.eq\("curso_id", cursoId\)/);
  assert.match(sync, /\.eq\("status", "published"\)/);
  assert.match(sync, /\.in\("classe_id", classeIds\)/);
  assert.match(sync, /\.in\("curso_curriculo_id", \[\.\.\.curriculoPorClasse\.values\(\)\]\)/);
  assert.match(sync, /curriculoPorClasse\.get\(m\.classe_id\) !== m\.curso_curriculo_id/);
  assert.match(sync, /m\.avaliacao_disciplina_id \?\? m\.disciplina_id/);
  assert.match(sync, /avaliacao_disciplina_id: item\.avaliacaoDisciplinaId/);
  assert.doesNotMatch(sync, /ignoreDuplicates: false/);
});

test('onboarding não usa o ano civil para criar turmas ou matrizes sem ano canónico', () => {
  const route = source('apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply/route.ts');
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /\.eq\("escola_id", resolvedEscolaId\)/);
  assert.match(route, /createCurriculo: true/);
  assert.match(route, /createTurmas: false/);
  assert.match(route, /anoLetivoId: year\.id/);
  assert.doesNotMatch(route, /new Date\(\)\.getFullYear/);
});

test('guard PostgreSQL protege todos os escritores, não apenas uma API', () => {
  const migration = source('supabase/migrations/20271118120000_guard_turma_assessment_identity_install.sql');
  assert.match(migration, /BEFORE INSERT OR UPDATE OF curso_matriz_id, avaliacao_disciplina_id/);
  assert.match(migration, /COALESCE\(cm\.avaliacao_disciplina_id, cm\.disciplina_id\)/);
  assert.match(migration, /v_disciplina_escola_id IS DISTINCT FROM NEW\.escola_id/);
  assert.match(migration, /turma_disciplinas_avaliacao_identidade_nn/);
  assert.doesNotMatch(migration, /SECURITY DEFINER|UPDATE public\.notas|DELETE FROM public\.notas/);
});
