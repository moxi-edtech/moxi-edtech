-- Migration: Competency-based Evaluation and Certification Rules
-- Date: 02/05/2026

BEGIN;

-- 1. Table for module evaluations
CREATE TABLE IF NOT EXISTS public.formacao_modulo_avaliacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    inscricao_id uuid NOT NULL REFERENCES public.formacao_inscricoes(id) ON DELETE CASCADE,
    modulo_id uuid NOT NULL REFERENCES public.formacao_cohort_modulos(id) ON DELETE CASCADE,
    nota numeric(5,2), -- Optional numeric grade
    conceito text CHECK (conceito IN ('apto', 'nao_apto', 'em_progresso', 'isento')),
    observacoes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT formacao_modulo_avaliacoes_unique UNIQUE (inscricao_id, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_modulo_avaliacoes_escola ON public.formacao_modulo_avaliacoes(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_modulo_avaliacoes_inscricao ON public.formacao_modulo_avaliacoes(inscricao_id);

ALTER TABLE public.formacao_modulo_avaliacoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY formacao_modulo_avaliacoes_select_policy
  ON public.formacao_modulo_avaliacoes
  FOR SELECT
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY formacao_modulo_avaliacoes_mutation_policy
  ON public.formacao_modulo_avaliacoes
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- 2. View for student progress and certification eligibility
CREATE OR REPLACE VIEW public.vw_formacao_estudante_progresso AS
WITH attendance_stats AS (
    SELECT 
        fi.id as inscricao_id,
        count(fp.id) as total_aulas_realizadas,
        count(fp.id) FILTER (WHERE fp.presente = true) as total_presencas,
        CASE 
            WHEN count(fp.id) > 0 THEN (count(fp.id) FILTER (WHERE fp.presente = true)::float / count(fp.id)::float) * 100
            ELSE 100
        END as percentual_presenca
    FROM 
        public.formacao_inscricoes fi
    LEFT JOIN public.formacao_aulas fa ON fa.cohort_id = fi.cohort_id AND fa.status = 'realizada'
    LEFT JOIN public.formacao_presencas fp ON fp.aula_id = fa.id AND fp.inscricao_id = fi.id
    GROUP BY 
        fi.id
),
module_stats AS (
    SELECT 
        fi.id as inscricao_id,
        count(fm.id) as total_modulos,
        count(fma.id) FILTER (WHERE fma.conceito = 'apto' OR fma.conceito = 'isento') as modulos_aprovados
    FROM 
        public.formacao_inscricoes fi
    JOIN public.formacao_cohort_modulos fm ON fm.cohort_id = fi.cohort_id
    LEFT JOIN public.formacao_modulo_avaliacoes fma ON fma.modulo_id = fm.id AND fma.inscricao_id = fi.id
    GROUP BY 
        fi.id
)
SELECT 
    fi.id as inscricao_id,
    fi.escola_id,
    fi.cohort_id,
    fi.formando_user_id,
    att.percentual_presenca,
    att.total_aulas_realizadas,
    mod.total_modulos,
    mod.modulos_aprovados,
    (att.percentual_presenca >= 75 AND mod.modulos_aprovados = mod.total_modulos) as elegivel_certificacao
FROM 
    public.formacao_inscricoes fi
JOIN attendance_stats att ON att.inscricao_id = fi.id
JOIN module_stats mod ON mod.inscricao_id = fi.id;

COMMIT;
