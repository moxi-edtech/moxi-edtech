BEGIN;

-- O índice 261240 chamado idx_dependencias_academicas_transicao_aluno cobre
-- (escola_id, aluno_id, status), mas não cobre o FK aluno_id como primeira
-- coluna. O advisor exige um índice líder em aluno_id para cascatas/joins do FK.
CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_aluno_id_fk
  ON public.dependencias_academicas_transicao(aluno_id);

COMMIT;
