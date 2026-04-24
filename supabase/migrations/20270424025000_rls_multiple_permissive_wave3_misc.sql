BEGIN;

-- Wave 3 (safe subset): consolidate multiple permissive policies where
-- duplication is mechanical and semantics can be preserved directly.
-- Explicitly excluded in this wave due functional risk and mixed intake model:
--   - public.mensalidades
--   - public.formacao_inscricoes_staging

-- ---------------------------------------------------------------------------
-- centros_formacao: ALL(super_admin) + SELECT(super_admin/staff) duplicate on SELECT
-- Keep SELECT; split ALL into write-only policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS centros_formacao_super_admin_mutation ON public.centros_formacao;

CREATE POLICY centros_formacao_super_admin_insert
ON public.centros_formacao
FOR INSERT TO public
WITH CHECK (check_super_admin_role());

CREATE POLICY centros_formacao_super_admin_update
ON public.centros_formacao
FOR UPDATE TO public
USING (check_super_admin_role())
WITH CHECK (check_super_admin_role());

CREATE POLICY centros_formacao_super_admin_delete
ON public.centros_formacao
FOR DELETE TO public
USING (check_super_admin_role());

-- ---------------------------------------------------------------------------
-- avaliacoes: duplicated SELECT with identical condition.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_or_super_admin_select ON public.avaliacoes;

-- ---------------------------------------------------------------------------
-- curso_matriz: two SELECT policies for authenticated.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS curso_matriz_select ON public.curso_matriz;
DROP POLICY IF EXISTS curso_matriz_select_membro ON public.curso_matriz;

CREATE POLICY curso_matriz_select
ON public.curso_matriz
FOR SELECT TO authenticated
USING (
  ((escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin']::text[]))
  OR is_membro_escola(escola_id)
);

-- ---------------------------------------------------------------------------
-- escola_users: duplicated INSERT (super_admin-only is subset of main insert)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS escola_users_insert_super_admin ON public.escola_users;

-- ---------------------------------------------------------------------------
-- fiscal_*: ALL(mutation) + SELECT(read) duplicates on SELECT.
-- Keep SELECT; split mutation ALL into write-only policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fiscal_chaves_mutation ON public.fiscal_chaves;
CREATE POLICY fiscal_chaves_insert
ON public.fiscal_chaves
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));
CREATE POLICY fiscal_chaves_update
ON public.fiscal_chaves
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));
CREATE POLICY fiscal_chaves_delete
ON public.fiscal_chaves
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));

DROP POLICY IF EXISTS fiscal_documento_itens_mutation ON public.fiscal_documento_itens;
CREATE POLICY fiscal_documento_itens_insert
ON public.fiscal_documento_itens
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_documento_itens_update
ON public.fiscal_documento_itens
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_documento_itens_delete
ON public.fiscal_documento_itens
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));

DROP POLICY IF EXISTS fiscal_documentos_eventos_mutation ON public.fiscal_documentos_eventos;
CREATE POLICY fiscal_documentos_eventos_insert
ON public.fiscal_documentos_eventos
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_documentos_eventos_update
ON public.fiscal_documentos_eventos
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_documentos_eventos_delete
ON public.fiscal_documentos_eventos
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));

DROP POLICY IF EXISTS fiscal_escola_bindings_mutation ON public.fiscal_escola_bindings;
CREATE POLICY fiscal_escola_bindings_insert
ON public.fiscal_escola_bindings
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));
CREATE POLICY fiscal_escola_bindings_update
ON public.fiscal_escola_bindings
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));
CREATE POLICY fiscal_escola_bindings_delete
ON public.fiscal_escola_bindings
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin']::text[]));

DROP POLICY IF EXISTS fiscal_saft_exports_mutation ON public.fiscal_saft_exports;
CREATE POLICY fiscal_saft_exports_insert
ON public.fiscal_saft_exports
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_saft_exports_update
ON public.fiscal_saft_exports
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_saft_exports_delete
ON public.fiscal_saft_exports
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));

DROP POLICY IF EXISTS fiscal_series_mutation ON public.fiscal_series;
CREATE POLICY fiscal_series_insert
ON public.fiscal_series
FOR INSERT TO authenticated
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_series_update
ON public.fiscal_series
FOR UPDATE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]))
WITH CHECK (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));
CREATE POLICY fiscal_series_delete
ON public.fiscal_series
FOR DELETE TO authenticated
USING (check_super_admin_role() OR user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator']::text[]));

-- ---------------------------------------------------------------------------
-- horario/infra tables: ALL(write) + SELECT duplicate on SELECT.
-- Keep SELECT; split ALL into write-only policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS horario_slots_write ON public.horario_slots;
CREATE POLICY horario_slots_insert
ON public.horario_slots
FOR INSERT TO authenticated
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY horario_slots_update
ON public.horario_slots
FOR UPDATE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY horario_slots_delete
ON public.horario_slots
FOR DELETE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));

DROP POLICY IF EXISTS professor_disponibilidade_write ON public.professor_disponibilidade;
CREATE POLICY professor_disponibilidade_insert
ON public.professor_disponibilidade
FOR INSERT TO authenticated
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY professor_disponibilidade_update
ON public.professor_disponibilidade
FOR UPDATE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY professor_disponibilidade_delete
ON public.professor_disponibilidade
FOR DELETE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));

DROP POLICY IF EXISTS quadro_horarios_write ON public.quadro_horarios;
CREATE POLICY quadro_horarios_insert
ON public.quadro_horarios
FOR INSERT TO authenticated
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY quadro_horarios_update
ON public.quadro_horarios
FOR UPDATE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY quadro_horarios_delete
ON public.quadro_horarios
FOR DELETE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));

DROP POLICY IF EXISTS salas_write ON public.salas;
CREATE POLICY salas_insert
ON public.salas
FOR INSERT TO authenticated
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY salas_update
ON public.salas
FOR UPDATE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));
CREATE POLICY salas_delete
ON public.salas
FOR DELETE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria']::text[]));

DROP POLICY IF EXISTS servicos_escola_write_admin ON public.servicos_escola;
CREATE POLICY servicos_escola_insert_admin
ON public.servicos_escola
FOR INSERT TO authenticated
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[]));
CREATE POLICY servicos_escola_update_admin
ON public.servicos_escola
FOR UPDATE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[]))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[]));
CREATE POLICY servicos_escola_delete_admin
ON public.servicos_escola
FOR DELETE TO authenticated
USING ((escola_id = current_tenant_escola_id()) AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[]));

-- ---------------------------------------------------------------------------
-- turma_disciplinas: two SELECT policies for authenticated.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS turma_disciplinas_select ON public.turma_disciplinas;
DROP POLICY IF EXISTS turma_disciplinas_select_membro ON public.turma_disciplinas;

CREATE POLICY turma_disciplinas_select
ON public.turma_disciplinas
FOR SELECT TO authenticated
USING (
  ((escola_id = current_tenant_escola_id())
    AND user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin']::text[]))
  OR is_membro_escola(escola_id)
);

COMMIT;
