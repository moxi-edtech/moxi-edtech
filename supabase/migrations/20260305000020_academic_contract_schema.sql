BEGIN;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS ano_letivo_id uuid,
  ADD COLUMN IF NOT EXISTS turno text,
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal integer,
  ADD COLUMN IF NOT EXISTS min_disciplinas_core integer;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_turno_check
  CHECK (turno IS NULL OR turno IN ('M', 'T', 'N'));

ALTER TABLE public.classes
  ADD CONSTRAINT classes_carga_horaria_semanal_check
  CHECK (carga_horaria_semanal IS NULL OR carga_horaria_semanal > 0);

ALTER TABLE public.classes
  ADD CONSTRAINT classes_min_disciplinas_core_check
  CHECK (min_disciplinas_core IS NULL OR min_disciplinas_core >= 0);

CREATE INDEX IF NOT EXISTS idx_classes_escola_ano_letivo
  ON public.classes (escola_id, ano_letivo_id);

ALTER TABLE public.disciplinas_catalogo
  ADD COLUMN IF NOT EXISTS carga_horaria_semana integer,
  ADD COLUMN IF NOT EXISTS is_core boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_avaliavel boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS aplica_modelo_avaliacao_id uuid,
  ADD COLUMN IF NOT EXISTS herda_de_disciplina_id uuid;

ALTER TABLE public.disciplinas_catalogo
  ADD CONSTRAINT disciplinas_carga_horaria_semana_check
  CHECK (carga_horaria_semana IS NULL OR carga_horaria_semana > 0);

ALTER TABLE public.turma_disciplinas
  ADD COLUMN IF NOT EXISTS modelo_avaliacao_id uuid;

CREATE INDEX IF NOT EXISTS idx_turma_disciplinas_modelo_avaliacao
  ON public.turma_disciplinas (modelo_avaliacao_id);

COMMIT;
