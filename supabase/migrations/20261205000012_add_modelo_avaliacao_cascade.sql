BEGIN;

ALTER TABLE public.modelos_avaliacao
  ADD COLUMN IF NOT EXISTS curso_id uuid;

ALTER TABLE public.modelos_avaliacao
  ADD CONSTRAINT modelos_avaliacao_curso_fk
  FOREIGN KEY (curso_id)
  REFERENCES public.cursos(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS modelos_avaliacao_curso_idx
  ON public.modelos_avaliacao (escola_id, curso_id);

CREATE UNIQUE INDEX IF NOT EXISTS modelos_avaliacao_curso_default_ux
  ON public.modelos_avaliacao (escola_id, curso_id)
  WHERE curso_id IS NOT NULL AND is_default IS TRUE;

ALTER TABLE public.curso_matriz
  ADD COLUMN IF NOT EXISTS modelo_excecao_id uuid;

ALTER TABLE public.curso_matriz
  ADD CONSTRAINT curso_matriz_modelo_excecao_fk
  FOREIGN KEY (modelo_excecao_id)
  REFERENCES public.modelos_avaliacao(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS curso_matriz_modelo_excecao_idx
  ON public.curso_matriz (modelo_excecao_id);

COMMIT;
