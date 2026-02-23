BEGIN;

CREATE INDEX IF NOT EXISTS idx_mv_professor_pendencias_escola_turma
  ON internal.mv_professor_pendencias (escola_id, turma_id);

COMMIT;
