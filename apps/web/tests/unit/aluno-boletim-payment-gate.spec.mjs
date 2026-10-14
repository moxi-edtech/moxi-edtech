import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('todos os caminhos de visualização e emissão de notas usam a mesma autorização paga', () => {
  for (const path of [
    'app/api/aluno/boletim/route.ts',
    'app/api/aluno/boletim/pdf/route.ts',
    'app/api/aluno/dashboard/route.ts',
    'app/api/aluno/home/recent-grades/route.ts',
    'app/api/aluno/disciplinas/[disciplinaId]/notas/route.ts',
    'app/api/aluno/documentos/emitir/route.ts',
  ]) {
    assert.match(read(path), /checkBoletimAccess\(/, path);
  }
});

test('notas pagas são extraídas da fonte actual, não da vista materializada do boletim', () => {
  const source = read('lib/aluno/boletimNotas.ts');
  assert.match(source, /\.from\("notas"\)/);
  assert.match(source, /\.from\("turma_disciplinas"\)/);
  assert.doesNotMatch(read('app/api/aluno/boletim/route.ts'), /vw_boletim_por_matricula/);
  assert.doesNotMatch(read('app/api/aluno/boletim/pdf/route.ts'), /vw_boletim_por_matricula/);
  assert.match(read('lib/aluno/boletimAccess.ts'), /status === "settled"/);
  assert.match(read('lib/aluno/boletimAccess.ts'), /order.status === "granted"/);
});

test('o portal não duplica MAC e NPP nem apresenta notas como nota anual fictícia', () => {
  const source = read('components/aluno/tabs/TabNotas.tsx');
  assert.doesNotMatch(source, /<span>MAC:<\/span>/);
  assert.doesNotMatch(source, /<span>NPP:<\/span>/);
  assert.doesNotMatch(source, /Nota Final/);
  assert.match(source, /avaliacao\.nome/);
});

test('a secretaria confirma o pagamento no mesmo fluxo de recebimentos e alerta para liberação de notas', () => {
  const source = read('components/secretaria/PagamentosPendentesWindow.tsx');
  assert.match(source, /validar\(pagamentoId, aprovado/);
  assert.match(source, /Confirmar e liberar notas/);
  assert.match(read('components/aluno/tabs/TabDocumentos.tsx'), /Math\.min\(30_000 \* 2 \*\* failures, 300_000\)/);
  assert.match(read('components/aluno/tabs/TabNotas.tsx'), /isLiberado \? 120_000/);
  assert.match(read('components/aluno/tabs/TabNotas.tsx'), /document\.hidden/);
});
