import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
test('boletim rejects unauthorized student and fails closed on payment lookup error', () => {
  const src = read('app/api/aluno/boletim/route.ts');
  assert.match(src, /if \(!alunoId\).*status: 403/);
  assert.match(src, /if \(permissionError\).*status: 503/);
  assert.ok(src.indexOf('if (!isLiberado) return') < src.indexOf('.from("vw_boletim_por_matricula")'));
});
test('all grade endpoints use confirmed grant; recent grades scoped to current enrollment', () => {
  for (const path of ['app/api/aluno/home/recent-grades/route.ts', 'app/api/aluno/disciplinas/[disciplinaId]/notas/route.ts', 'app/api/aluno/boletim/pdf/route.ts']) {
    const src = read(path);
    assert.match(src, /DOC_DECLARACAO_NOTAS/);
    assert.match(src, /matricula_id/);
    assert.match(src, /\.eq\(['"]status['"], ['"]granted['"]\)/);
  }
});
test('boletim does not fabricate MAC and NPP from the same trimester grade', () => {
  const src = read('components/aluno/tabs/TabNotas.tsx');
  assert.doesNotMatch(src, /<span>MAC:<\/span>/);
  assert.doesNotMatch(src, /<span>NPP:<\/span>/);
});
