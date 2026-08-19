BEGIN;

ALTER TABLE public.configuracoes_pedagogicas
  ADD COLUMN IF NOT EXISTS permitir_inscricao_condicional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_progressao_com_recurso boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracoes_pedagogicas.permitir_inscricao_condicional IS
  'Autoriza o movimento para a etapa seguinte enquanto o aluno mantém disciplinas em recurso.';

COMMENT ON COLUMN public.configuracoes_pedagogicas.permitir_progressao_com_recurso IS
  'Controla se o regime da escola admite progressão com recurso antes da decisão final.';

COMMIT;
