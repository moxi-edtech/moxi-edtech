BEGIN;

-- auth_rls_initplan: force initplan for auth.uid() calls
ALTER POLICY escola_users_select_v3 ON public.escola_users
USING (
  (user_id = (select auth.uid()))
  OR ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','staff_admin']::text[]))
  OR check_super_admin_role()
);

ALTER POLICY eventos_escola_read ON public.eventos
USING (
  escola_id IN (
    SELECT profiles.escola_id
    FROM profiles
    WHERE profiles.user_id = (select auth.uid())
  )
);

ALTER POLICY eventos_sistema_insert ON public.eventos
WITH CHECK (
  escola_id IN (
    SELECT profiles.escola_id
    FROM profiles
    WHERE profiles.user_id = (select auth.uid())
  )
);

ALTER POLICY fecho_select ON public.fecho_caixa
USING (
  (escola_id = current_tenant_escola_id())
  AND ((declared_by = (select auth.uid())) OR user_has_role_in_school(escola_id, ARRAY['financeiro','admin','global_admin','super_admin']::text[]))
);

ALTER POLICY formacao_certificados_emitidos_select_policy ON public.formacao_certificados_emitidos
USING (
  (escola_id = current_tenant_escola_id())
  AND (
    can_access_formacao_backoffice(escola_id)
    OR ((formando_user_id = (select auth.uid())) AND user_has_role_in_school(escola_id, ARRAY['formando']::text[]))
  )
);

ALTER POLICY formacao_cohort_formadores_select_policy ON public.formacao_cohort_formadores
USING (
  (escola_id = current_tenant_escola_id())
  AND (can_access_formacao_backoffice(escola_id) OR (formador_user_id = (select auth.uid())))
);

ALTER POLICY "Gestores gerem os seus contratos B2B" ON public.formacao_contratos_b2b
USING (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (select auth.uid())
  )
);

ALTER POLICY formacao_honorarios_select_policy ON public.formacao_honorarios_lancamentos
USING (
  (escola_id = current_tenant_escola_id())
  AND (
    can_access_formacao_backoffice(escola_id)
    OR ((formador_user_id = (select auth.uid())) AND user_has_role_in_school(escola_id, ARRAY['formador']::text[]))
  )
);

ALTER POLICY formacao_inscricoes_select_policy ON public.formacao_inscricoes
USING (
  (escola_id = current_tenant_escola_id())
  AND (can_access_formacao_backoffice(escola_id) OR (formando_user_id = (select auth.uid())))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'formacao_inscricoes_staging'
      AND policyname = 'Gestores gerem as suas próprias inscrições staging'
  ) THEN
    CREATE POLICY "Gestores gerem as suas próprias inscrições staging"
      ON public.formacao_inscricoes_staging
      USING (true);
  END IF;
END
$$;

ALTER POLICY "Gestores gerem as suas próprias inscrições staging" ON public.formacao_inscricoes_staging
USING (
  escola_id IN (
    SELECT escola_users.escola_id
    FROM escola_users
    WHERE escola_users.user_id = (select auth.uid())
  )
);

ALTER POLICY import_migrations_staff_write ON public.import_migrations
WITH CHECK (
  ((select auth.uid()) IS NOT NULL)
  AND (is_staff_escola(escola_id) OR is_super_admin() OR ((select auth.uid()) = created_by))
);

ALTER POLICY mensalidades_select ON public.mensalidades
USING (
  (escola_id = current_tenant_escola_id())
  AND (
    user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']::text[])
    OR EXISTS (
      SELECT 1
      FROM alunos a
      WHERE a.id = mensalidades.aluno_id
        AND a.escola_id = mensalidades.escola_id
        AND (a.usuario_auth_id = (select auth.uid()) OR a.profile_id = (select auth.uid()))
    )
  )
);

ALTER POLICY notas_select_tenant ON public.notas
USING (
  (escola_id = current_tenant_escola_id())
  AND (
    user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro']::text[])
    OR EXISTS (
      SELECT 1
      FROM matriculas m
      JOIN alunos a ON a.id = m.aluno_id
      WHERE m.id = notas.matricula_id
        AND a.escola_id = notas.escola_id
        AND (a.usuario_auth_id = (select auth.uid()) OR a.profile_id = (select auth.uid()))
    )
  )
);

ALTER POLICY notificacoes_proprias_read ON public.notificacoes
USING (destinatario_id = (select auth.uid()));

ALTER POLICY notificacoes_proprias_update ON public.notificacoes
USING (destinatario_id = (select auth.uid()))
WITH CHECK (destinatario_id = (select auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pagamentos'
      AND policyname = 'pagamentos_select_secretaria_own'
  ) THEN
    CREATE POLICY pagamentos_select_secretaria_own
      ON public.pagamentos
      USING (true);
  END IF;
END
$$;

ALTER POLICY pagamentos_select_secretaria_own ON public.pagamentos
USING (
  (escola_id = current_tenant_escola_id())
  AND ((created_by = (select auth.uid())) OR user_has_role_in_school(escola_id, ARRAY['financeiro','admin','global_admin','super_admin']::text[]))
);

ALTER POLICY school_subjects_read ON public.school_subjects
USING (
  escola_id IN (
    SELECT p.escola_id
    FROM profiles p
    WHERE p.user_id = (select auth.uid())
  )
);

ALTER POLICY school_subjects_write ON public.school_subjects
WITH CHECK (
  escola_id IN (
    SELECT p.escola_id
    FROM profiles p
    WHERE p.user_id = (select auth.uid())
  )
);

ALTER POLICY school_subjects_update ON public.school_subjects
USING (
  escola_id IN (
    SELECT p.escola_id
    FROM profiles p
    WHERE p.user_id = (select auth.uid())
  )
)
WITH CHECK (
  escola_id IN (
    SELECT p.escola_id
    FROM profiles p
    WHERE p.user_id = (select auth.uid())
  )
);

-- duplicate_index: drop only clearly redundant indexes
DROP INDEX IF EXISTS public.ux_curso_matriz_curso_classe_disciplina;
DROP INDEX IF EXISTS public.ux_curso_matriz_curriculo_disciplina;
DROP INDEX IF EXISTS public.escolas_slug_idx;
DROP INDEX IF EXISTS public.ix_outbox_ready;

COMMIT;
