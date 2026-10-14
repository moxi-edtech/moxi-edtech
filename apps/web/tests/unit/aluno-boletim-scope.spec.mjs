import test from 'node:test';
import assert from 'node:assert/strict';
import Scope from '../../src/lib/aluno/resolveBoletimMatricula.ts';

const { assertBoletimMatriculaScope: check } = Scope;
const matriculas = {
  actual: { session_id: 'session-2026', status: 'ativa' },
  anterior: { session_id: 'session-2025', status: 'encerrada' },
  trancada: { session_id: 'session-2026', status: 'trancada' },
  transferida: { session_id: 'session-2026', status: 'transferida' },
};

test('duas matrículas permanecem isoladas por session_id', () => {
  assert.doesNotThrow(() => check(matriculas.actual, 'session-2026', 'CURRENT', 'READ'));
  assert.doesNotThrow(() => check(matriculas.anterior, 'session-2025', 'HISTORICAL_READ', 'READ'));
  assert.throws(() => check(matriculas.anterior, 'session-2026', 'CURRENT', 'READ'), /ano letivo/);
  assert.throws(() => check(matriculas.actual, 'session-2025', 'HISTORICAL_READ', 'READ'), /ano letivo/);
});

test('pedido novo não aceita matrícula encerrada, trancada, transferida ou ausente', () => {
  assert.doesNotThrow(() => check(matriculas.actual, 'session-2026', 'CURRENT', 'WRITE'));
  assert.throws(() => check(matriculas.anterior, 'session-2025', 'HISTORICAL_READ', 'WRITE'), /encerrado/);
  assert.throws(() => check(matriculas.trancada, 'session-2026', 'CURRENT', 'WRITE'), /não está ativa/);
  assert.throws(() => check(matriculas.transferida, 'session-2026', 'CURRENT', 'WRITE'), /não está ativa/);
  assert.throws(() => check(null, 'session-2026', 'CURRENT', 'WRITE'), /não está ativa/);
});
