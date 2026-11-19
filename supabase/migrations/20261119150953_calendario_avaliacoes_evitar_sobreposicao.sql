-- Migração aplicada no Supabase KLASSE em 2026-11-19; versão 20261119150953.
-- Impede colisão por escola/turma/janela temporal mesmo sob operações concorrentes.
-- Na ausência de fim, o intervalo de uma avaliação dura 60 minutos.
ALTER TABLE public.calendario_avaliacoes
  ADD CONSTRAINT calendario_avaliacoes_turma_sem_sobreposicao
  EXCLUDE USING gist (
    escola_id WITH =,
    turma_id WITH =,
    tsrange(
      data + inicio,
      CASE WHEN fim IS NOT NULL THEN data + fim
           ELSE data + inicio + INTERVAL '1 hour' END,
      '[)'
    ) WITH &&
  ) WHERE (estado <> 'cancelado');

COMMENT ON CONSTRAINT calendario_avaliacoes_turma_sem_sobreposicao
  ON public.calendario_avaliacoes IS
  'Impede duas avaliações com horários coincidentes na mesma turma, inclusive sob concorrência.';
