ALTER TABLE public.atividades_pedagogicas
  ADD COLUMN IF NOT EXISTS aula_id uuid REFERENCES public.aulas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_aula_id uuid REFERENCES public.planos_aula(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_pedagogicas_aula
  ON public.atividades_pedagogicas (escola_id, aula_id);
CREATE INDEX IF NOT EXISTS idx_atividades_pedagogicas_plano_aula
  ON public.atividades_pedagogicas (escola_id, plano_aula_id);
