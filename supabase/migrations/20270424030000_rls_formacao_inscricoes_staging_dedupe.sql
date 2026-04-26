BEGIN;

-- Deduplicate authenticated INSERT policies on formacao_inscricoes_staging
-- without changing effective capabilities:
-- - anon keeps public submission path
-- - authenticated keeps both paths (gestor OR public submission rule)
-- - gestor keeps select/update/delete over own school scope

DROP POLICY IF EXISTS "Gestores gerem as suas próprias inscrições staging" ON public.formacao_inscricoes_staging;
DROP POLICY IF EXISTS formacao_inscricoes_staging_select_gestores ON public.formacao_inscricoes_staging;
DROP POLICY IF EXISTS formacao_inscricoes_staging_update_gestores ON public.formacao_inscricoes_staging;
DROP POLICY IF EXISTS formacao_inscricoes_staging_delete_gestores ON public.formacao_inscricoes_staging;
DROP POLICY IF EXISTS formacao_inscricoes_staging_insert_authenticated ON public.formacao_inscricoes_staging;

CREATE POLICY formacao_inscricoes_staging_select_gestores
ON public.formacao_inscricoes_staging
FOR SELECT TO authenticated
USING (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY formacao_inscricoes_staging_update_gestores
ON public.formacao_inscricoes_staging
FOR UPDATE TO authenticated
USING (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY formacao_inscricoes_staging_delete_gestores
ON public.formacao_inscricoes_staging
FOR DELETE TO authenticated
USING (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY formacao_inscricoes_staging_insert_authenticated
ON public.formacao_inscricoes_staging
FOR INSERT TO authenticated
WITH CHECK (
  (
    escola_id IN (
      SELECT escola_users.escola_id
      FROM escola_users
      WHERE escola_users.user_id = (SELECT auth.uid())
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM formacao_cohorts c
      WHERE c.id = formacao_inscricoes_staging.cohort_id
        AND c.escola_id = c.escola_id
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

DROP POLICY IF EXISTS "Permitir submissão pública de inscrições" ON public.formacao_inscricoes_staging;

CREATE POLICY "Permitir submissão pública de inscrições"
ON public.formacao_inscricoes_staging
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM formacao_cohorts c
    WHERE c.id = formacao_inscricoes_staging.cohort_id
      AND c.escola_id = c.escola_id
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
