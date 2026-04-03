import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInstallPresetSkippedAppliedPayload,
  buildSyncTurmasSummary,
  requiresNoRebuildConfirmation,
} from '../../src/lib/academico/curriculo-operacao';

test('requiresNoRebuildConfirmation exige confirmacao quando ha turmas e rebuild=false', () => {
  assert.equal(
    requiresNoRebuildConfirmation({
      rebuildTurmas: false,
      existingTurmasCount: 3,
      confirmNoRebuildWithExistingTurmas: false,
    }),
    true
  );

  assert.equal(
    requiresNoRebuildConfirmation({
      rebuildTurmas: false,
      existingTurmasCount: 3,
      confirmNoRebuildWithExistingTurmas: true,
    }),
    false
  );

  assert.equal(
    requiresNoRebuildConfirmation({
      rebuildTurmas: true,
      existingTurmasCount: 3,
      confirmNoRebuildWithExistingTurmas: false,
    }),
    false
  );
});

test('buildSyncTurmasSummary calcula turmas_afetadas por rebuild ou geracao', () => {
  const rebuildSummary = buildSyncTurmasSummary({
    rebuildTurmas: true,
    existingTurmasCount: 5,
    turmasCountAfter: 5,
    shouldGenerateTurmas: true,
    autoGenerateExecuted: false,
    autoGenerateSkippedReason: 'turmas_already_exist',
    confirmNoRebuildWithExistingTurmas: false,
  });
  assert.equal(rebuildSummary.turmas_afetadas, 5);
  assert.equal(rebuildSummary.rebuild_executado, true);

  const noRebuildSummary = buildSyncTurmasSummary({
    rebuildTurmas: false,
    existingTurmasCount: 2,
    turmasCountAfter: 4,
    shouldGenerateTurmas: true,
    autoGenerateExecuted: true,
    autoGenerateSkippedReason: null,
    confirmNoRebuildWithExistingTurmas: true,
  });
  assert.equal(noRebuildSummary.turmas_afetadas, 2);
  assert.equal(noRebuildSummary.rebuild_executado, false);
  assert.equal(noRebuildSummary.confirm_no_rebuild_used, true);
});

test('buildInstallPresetSkippedAppliedPayload retorna motivo e acao recomendada', () => {
  const payload = buildInstallPresetSkippedAppliedPayload('escola-123');
  assert.equal(payload.skipped, true);
  assert.equal(payload.reason_code, 'CURRICULO_JA_PUBLICADO');
  assert.equal(payload.recommended_action.path, '/escola/escola-123/admin/configuracoes/turmas');
});
