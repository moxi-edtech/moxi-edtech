import { test, expect } from '@playwright/test';
import { resolveSelectedStudentId } from '../src/lib/portalAlunoAuth';

test.describe('Aluno portal authorization (IDOR guard)', () => {
  test('rejects selected student outside authorized set', async () => {
    const authorized = ['stu-a', 'stu-b'];
    const chosen = resolveSelectedStudentId({
      selectedId: 'stu-x',
      authorizedIds: authorized,
      fallbackId: 'stu-a',
    });

    expect(chosen).toBe('stu-a');
  });

  test('accepts selected student inside authorized set', async () => {
    const authorized = ['stu-a', 'stu-b'];
    const chosen = resolveSelectedStudentId({
      selectedId: 'stu-b',
      authorizedIds: authorized,
      fallbackId: 'stu-a',
    });

    expect(chosen).toBe('stu-b');
  });

  test('returns null when no authorized students exist', async () => {
    const chosen = resolveSelectedStudentId({
      selectedId: 'stu-x',
      authorizedIds: [],
      fallbackId: null,
    });

    expect(chosen).toBeNull();
  });
});
