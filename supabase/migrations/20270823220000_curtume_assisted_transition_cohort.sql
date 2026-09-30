BEGIN;

CREATE TABLE IF NOT EXISTS public.academic_transition_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  ano_origem integer NOT NULL,
  ano_destino integer NOT NULL,
  modo text NOT NULL DEFAULT 'virada_assistida_sem_notas'
    CHECK (modo IN ('virada_assistida_sem_notas')),
  ativo boolean NOT NULL DEFAULT true,
  expira_em date NOT NULL,
  motivo text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_transition_cohorts_years_check CHECK (ano_destino = ano_origem + 1),
  CONSTRAINT academic_transition_cohorts_code_uk UNIQUE (escola_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.academic_transition_cohort_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.academic_transition_cohorts(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  matricula_origem_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  motivo_inclusao text NOT NULL,
  status text NOT NULL DEFAULT 'elegivel' CHECK (status IN ('elegivel', 'concluido', 'revisao_necessaria', 'excluido')),
  included_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  included_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_transition_cohort_members_uk UNIQUE (cohort_id, matricula_origem_id)
);

CREATE INDEX IF NOT EXISTS academic_transition_cohort_members_lookup_idx
  ON public.academic_transition_cohort_members (escola_id, matricula_origem_id, status);

-- Piloto Curtume: a escola entrou no KLASSE durante 2025 e confirmou que a
-- decisão será feita no Balcão. A inclusão é um snapshot por matrícula, não
-- uma regra aberta para toda a escola. Exclui apenas quem já possui resultado
-- final e matrícula 2026 ativa.
WITH curtume_cohort AS (
  INSERT INTO public.academic_transition_cohorts (
    escola_id, codigo, nome, ano_origem, ano_destino, expira_em, motivo
  )
  SELECT
    e.id,
    'CURTUME_2025_SEM_PAUTAS',
    'Curtume 2025 — virada assistida sem pautas completas',
    2025,
    2026,
    DATE '2027-09-30',
    'Piloto iniciado durante 2025; decisões de progressão serão confirmadas individualmente no Balcão.'
  FROM public.escolas e
  WHERE e.slug = 'complexo-escolar-privado-advetista-de-curtume'
  ON CONFLICT (escola_id, codigo) DO UPDATE
    SET ativo = true, expira_em = EXCLUDED.expira_em, updated_at = now()
  RETURNING id, escola_id
)
INSERT INTO public.academic_transition_cohort_members (
  escola_id, cohort_id, aluno_id, matricula_origem_id, motivo_inclusao
)
SELECT
  c.escola_id,
  c.id,
  m.aluno_id,
  m.id,
  'Matrícula Curtume 2025 incluída na virada assistida por ausência de pautas completas no piloto.'
FROM curtume_cohort c
JOIN public.matriculas m
  ON m.escola_id = c.escola_id
 AND m.ano_letivo = 2025
WHERE NOT (
  EXISTS (
    SELECT 1
    FROM public.historico_anos h
    WHERE h.escola_id = c.escola_id
      AND h.aluno_id = m.aluno_id
      AND h.ano_letivo = 2025
      AND nullif(btrim(coalesce(h.resultado_final, '')), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.matriculas destino
    WHERE destino.escola_id = c.escola_id
      AND destino.aluno_id = m.aluno_id
      AND destino.ano_letivo = 2026
      AND lower(coalesce(destino.status, '')) IN ('ativo', 'ativa', 'active')
  )
)
ON CONFLICT (cohort_id, matricula_origem_id) DO NOTHING;

ALTER TABLE public.academic_transition_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_transition_cohort_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_transition_cohorts_select ON public.academic_transition_cohorts
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id() OR public.check_super_admin_role());
CREATE POLICY academic_transition_cohort_members_select ON public.academic_transition_cohort_members
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id() OR public.check_super_admin_role());

GRANT SELECT ON public.academic_transition_cohorts, public.academic_transition_cohort_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_transition_cohorts, public.academic_transition_cohort_members TO service_role;

COMMIT;
