import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTeacherBiValid, normalizeTeacherBi } from '../../src/lib/escola/teacher-bi'

test('unknown BI stays null, without a fabricated identifier', () => {
  for (const value of [undefined, null, '', '  ']) {
    assert.equal(normalizeTeacherBi(value), null)
    assert.equal(isTeacherBiValid(value), true)
  }
})

test('BI is case-insensitive and trimmed', () => {
  assert.equal(normalizeTeacherBi('  123456789la123 '), '123456789LA123')
  assert.equal(isTeacherBiValid('  123456789la123 '), true)
})

test('rejects zero placeholders and malformed identifiers', () => {
  for (const value of ['00000000000000','00000000000001!', '123','123456789012345','123456789-LA12', '１２３４５６７８９０１２３４']) {
    assert.equal(isTeacherBiValid(value), false, value)
  }
})
