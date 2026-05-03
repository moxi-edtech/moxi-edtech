BEGIN;

-- Fix redundant and potentially broken RLS policies on formacao_inscricoes_staging
-- The previous policies had c.escola_id = c.escola_id which is redundant and misses the link to the row being inserted.

DROP POLICY IF EXISTS formacao_inscricoes_staging_insert_authenticated ON public.formacao_inscricoes_staging;
DROP POLICY IF EXISTS "Permitir submissão pública de inscrições" ON public.formacao_inscricoes_staging;

CREATE POLICY formacao_inscricoes_staging_insert_authenticated
ON public.formacao_inscricoes_staging
FOR INSERT TO authenticated
WITH CHECK (
  (
    escola_id IN (
      SELECT escola_users.escola_id
      FROM escola_users
      WHERE escola_users.user_id = auth.uid()
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM formacao_cohorts c
      WHERE c.id = cohort_id 
        AND c.escola_id = formacao_inscricoes_staging.escola_id
        AND (
          c.status = 'planeada'
          OR c.status = 'em_andamento'
          OR c.status = 'aberta'
        )
        AND (
          (SELECT count(*) FROM formacao_inscricoes WHERE formacao_inscricoes.cohort_id = c.id) < c.vagas
        )
    )
  )
);

CREATE POLICY "Permitir submissão pública de inscrições"
ON public.formacao_inscricoes_staging
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM formacao_cohorts c
    WHERE c.id = cohort_id 
      AND c.escola_id = formacao_inscricoes_staging.escola_id
      AND (
        c.status = 'planeada'
        OR c.status = 'em_andamento'
        OR c.status = 'aberta'
      )
      AND (
        (SELECT count(*) FROM formacao_inscricoes WHERE formacao_inscricoes.cohort_id = c.id) < c.vagas
      )
  )
);

COMMIT;
