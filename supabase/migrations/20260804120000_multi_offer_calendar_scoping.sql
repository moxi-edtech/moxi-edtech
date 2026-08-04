BEGIN;

CREATE TABLE IF NOT EXISTS public.school_education_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  education_subsystem text NOT NULL,
  education_level text NOT NULL,
  cycle text,
  course_id uuid REFERENCES public.cursos(id) ON DELETE SET NULL,
  grades text[] NOT NULL DEFAULT '{}'::text[],
  calendar_profile_id uuid REFERENCES public.calendario_templates(id) ON DELETE RESTRICT,
  active_from date NOT NULL DEFAULT CURRENT_DATE,
  active_to date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_education_offerings_subsystem_check CHECK (
    education_subsystem IN ('PRE_ESCOLAR', 'REGULAR_ADULTOS', 'TECNICO_PROFISSIONAL', 'SECUNDARIO_PEDAGOGICO')
  ),
  CONSTRAINT school_education_offerings_status_check CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT school_education_offerings_dates_check CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_education_offerings_identity_uq
  ON public.school_education_offerings (
    escola_id,
    education_subsystem,
    education_level,
    COALESCE(cycle, ''),
    COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(calendar_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.school_education_offerings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_education_offerings_select ON public.school_education_offerings;
CREATE POLICY school_education_offerings_select
  ON public.school_education_offerings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = school_education_offerings.escola_id
      AND eu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS school_education_offerings_manage ON public.school_education_offerings;
CREATE POLICY school_education_offerings_manage
  ON public.school_education_offerings FOR ALL TO authenticated
  USING (public.user_has_role_in_school(
    school_education_offerings.escola_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'admin_financeiro', 'admin_secretaria', 'secretaria']
  ))
  WITH CHECK (public.user_has_role_in_school(
    school_education_offerings.escola_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'admin_financeiro', 'admin_secretaria', 'secretaria']
  ));

GRANT SELECT, INSERT, UPDATE ON public.school_education_offerings TO authenticated;

ALTER TABLE public.calendario_template_items
  ADD COLUMN IF NOT EXISTS applies_to_all_offerings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS education_subsystems text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS education_levels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cycles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS grade_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS course_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS audience_roles text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.calendario_eventos
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.school_education_offerings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.calendario_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_item_id uuid REFERENCES public.calendario_template_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by uuid;

ALTER TABLE public.periodos_letivos
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.school_education_offerings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.calendario_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_item_id uuid REFERENCES public.calendario_template_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by uuid;

INSERT INTO public.school_education_offerings (
  escola_id, education_subsystem, education_level, course_id, status
)
SELECT
  c.escola_id,
  CASE
    WHEN lower(c.nome) LIKE '%pré%' OR lower(c.nome) LIKE '%pre-%' THEN 'PRE_ESCOLAR'
    ELSE 'REGULAR_ADULTOS'
  END,
  CASE
    WHEN lower(c.nome) LIKE '%pré%' OR lower(c.nome) LIKE '%pre-%' THEN 'PRE_SCHOOL'
    WHEN lower(c.nome) LIKE '%secund%' OR lower(c.nome) LIKE '%ciclo%' THEN 'SECONDARY'
    ELSE 'PRIMARY'
  END,
  c.id,
  'active'
FROM public.cursos c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.school_education_offerings o
  WHERE o.escola_id = c.escola_id
    AND o.course_id = c.id
);

CREATE INDEX IF NOT EXISTS idx_school_education_offerings_school_status
  ON public.school_education_offerings (escola_id, status, active_from);

CREATE INDEX IF NOT EXISTS idx_calendario_eventos_offering
  ON public.calendario_eventos (escola_id, offering_id, data_inicio);

CREATE INDEX IF NOT EXISTS idx_periodos_letivos_offering
  ON public.periodos_letivos (escola_id, offering_id, data_inicio);

COMMENT ON TABLE public.school_education_offerings IS
  'Ofertas educativas ativas da escola; o calendário é aplicado por oferta, não por escola inteira.';
COMMENT ON COLUMN public.school_education_offerings.calendar_profile_id IS
  'Template regulatório publicado para o ano/perfil escolhido; não é um atributo único da escola.';
COMMENT ON COLUMN public.calendario_template_items.applies_to_all_offerings IS
  'Quando false, o item só se aplica às ofertas que correspondem aos arrays de escopo.';

COMMIT;
