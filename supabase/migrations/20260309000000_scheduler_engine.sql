BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  nome text NOT NULL,
  tipo text,
  capacidade int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salas_escola
  ON public.salas (escola_id, nome);

CREATE TABLE IF NOT EXISTS public.horario_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  turno_id text NOT NULL,
  ordem int NOT NULL,
  inicio time NOT NULL,
  fim time NOT NULL,
  dia_semana int NOT NULL,
  is_intervalo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT horario_slots_dia_semana_check CHECK (dia_semana BETWEEN 1 AND 7)
);

CREATE INDEX IF NOT EXISTS idx_horario_slots_escola_turno
  ON public.horario_slots (escola_id, turno_id, dia_semana, ordem);

CREATE TABLE IF NOT EXISTS public.professor_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  professor_id uuid NOT NULL REFERENCES public.professores(id),
  dia_semana int NOT NULL,
  periodo_inicio time,
  periodo_fim time,
  tipo text DEFAULT 'indisponivel',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT professor_disponibilidade_dia_semana_check CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT professor_disponibilidade_tipo_check CHECK (tipo IN ('indisponivel', 'evitar'))
);

CREATE INDEX IF NOT EXISTS idx_professor_disponibilidade_escola_professor
  ON public.professor_disponibilidade (escola_id, professor_id, dia_semana);

CREATE TABLE IF NOT EXISTS public.quadro_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id),
  professor_id uuid REFERENCES public.professores(id),
  sala_id uuid REFERENCES public.salas(id),
  slot_id uuid NOT NULL REFERENCES public.horario_slots(id),
  versao_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_quadro_horarios_turma_slot
  ON public.quadro_horarios (turma_id, slot_id);

ALTER TABLE public.quadro_horarios
  DROP CONSTRAINT IF EXISTS quadro_horarios_professor_slot_excl;

ALTER TABLE public.quadro_horarios
  ADD CONSTRAINT quadro_horarios_professor_slot_excl
  EXCLUDE USING gist (professor_id WITH =, slot_id WITH =)
  WHERE (professor_id IS NOT NULL);

ALTER TABLE public.quadro_horarios
  DROP CONSTRAINT IF EXISTS quadro_horarios_sala_slot_excl;

ALTER TABLE public.quadro_horarios
  ADD CONSTRAINT quadro_horarios_sala_slot_excl
  EXCLUDE USING gist (sala_id WITH =, slot_id WITH =)
  WHERE (sala_id IS NOT NULL);

ALTER TABLE public.horario_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadro_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horario_slots_select ON public.horario_slots;
CREATE POLICY horario_slots_select
ON public.horario_slots
FOR SELECT
TO authenticated
USING (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS horario_slots_write ON public.horario_slots;
CREATE POLICY horario_slots_write
ON public.horario_slots
FOR ALL
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS professor_disponibilidade_select ON public.professor_disponibilidade;
CREATE POLICY professor_disponibilidade_select
ON public.professor_disponibilidade
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS professor_disponibilidade_write ON public.professor_disponibilidade;
CREATE POLICY professor_disponibilidade_write
ON public.professor_disponibilidade
FOR ALL
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS quadro_horarios_select ON public.quadro_horarios;
CREATE POLICY quadro_horarios_select
ON public.quadro_horarios
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria','professor']::text[])
);

DROP POLICY IF EXISTS quadro_horarios_write ON public.quadro_horarios;
CREATE POLICY quadro_horarios_write
ON public.quadro_horarios
FOR ALL
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS salas_select ON public.salas;
CREATE POLICY salas_select
ON public.salas
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS salas_write ON public.salas;
CREATE POLICY salas_write
ON public.salas
FOR ALL
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

COMMIT;
