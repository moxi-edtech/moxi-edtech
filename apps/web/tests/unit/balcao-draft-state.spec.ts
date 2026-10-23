import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveBalcaoDraftStatus } from '../../src/components/secretaria/command-center/BalcaoDraftState';

const original = { nome: '', turma: null, valor: 0, file: null as null | {name:string;size:number} };
test('M1: programmatic React state changes are detected even without DOM events', () => {
  assert.equal(deriveBalcaoDraftStatus(original, original), 'clean');
  const changed = { ...original, nome: 'Pessoa fictícia' };
  assert.equal(deriveBalcaoDraftStatus(changed,original), 'dirty');
  assert.equal(deriveBalcaoDraftStatus({ ...changed, nome: '' }, original), 'clean');
});
test('M1: attached receipt and document form are model values; clearing restores clean', () => {
  const withFile = { ...original, file: { name: 'fixture.txt', size: 18 } };
  assert.equal(deriveBalcaoDraftStatus(withFile,original), 'dirty');
  assert.equal(deriveBalcaoDraftStatus({ ...withFile, file: null },original), 'clean');
});
test('M1: submit takes precedence over dirty and a failed write remains dirty', () => {
  const value = { ...original, valor: 42 };
  assert.equal(deriveBalcaoDraftStatus(value,original, { submitting:true }), 'saving');
  assert.equal(deriveBalcaoDraftStatus(value,original, { submitting:false }), 'dirty');
  assert.equal(deriveBalcaoDraftStatus(value,value, { saved:true }), 'saved');
  assert.equal(deriveBalcaoDraftStatus(value,value, { saved:false }), 'clean');
});
test('M1: can represent each operation under the same contract', () => {
  const actions = ['enrollment.identification', 'enrollment.academic', 'reenrollment', 'checkout', 'profile', 'grade'];
  for (const action of actions) {
    assert.equal(deriveBalcaoDraftStatus({ action, value:1 },{ action, value:0 }), 'dirty');
  }
});
