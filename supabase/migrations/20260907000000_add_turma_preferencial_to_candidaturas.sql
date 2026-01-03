-- Preferência de turma no funil de admissão
ALTER TABLE public.candidaturas
ADD COLUMN IF NOT EXISTS turma_preferencial_id uuid REFERENCES public.turmas(id);

CREATE INDEX IF NOT EXISTS idx_candidaturas_turma_pref
  ON public.candidaturas(turma_preferencial_id);
