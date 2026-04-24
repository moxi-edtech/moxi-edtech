BEGIN;

-- Wave 2: formacao_* tables with duplicated permissive policies (ALL + SELECT).
-- Strategy: keep current SELECT policies; replace ALL mutation policies with explicit
-- INSERT/UPDATE/DELETE policies under the same backoffice guard.

-- formacao_certificado_templates
DROP POLICY IF EXISTS formacao_certificado_templates_mutation_policy ON public.formacao_certificado_templates;
CREATE POLICY formacao_certificado_templates_insert_policy
ON public.formacao_certificado_templates
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_certificado_templates_update_policy
ON public.formacao_certificado_templates
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_certificado_templates_delete_policy
ON public.formacao_certificado_templates
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_certificados_emitidos
DROP POLICY IF EXISTS formacao_certificados_emitidos_mutation_policy ON public.formacao_certificados_emitidos;
CREATE POLICY formacao_certificados_emitidos_insert_policy
ON public.formacao_certificados_emitidos
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_certificados_emitidos_update_policy
ON public.formacao_certificados_emitidos
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_certificados_emitidos_delete_policy
ON public.formacao_certificados_emitidos
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_clientes_b2b
DROP POLICY IF EXISTS formacao_clientes_b2b_mutation_policy ON public.formacao_clientes_b2b;
CREATE POLICY formacao_clientes_b2b_insert_policy
ON public.formacao_clientes_b2b
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_clientes_b2b_update_policy
ON public.formacao_clientes_b2b
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_clientes_b2b_delete_policy
ON public.formacao_clientes_b2b
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_cohort_financeiro
DROP POLICY IF EXISTS formacao_cohort_financeiro_mutation_policy ON public.formacao_cohort_financeiro;
CREATE POLICY formacao_cohort_financeiro_insert_policy
ON public.formacao_cohort_financeiro
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_financeiro_update_policy
ON public.formacao_cohort_financeiro
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_financeiro_delete_policy
ON public.formacao_cohort_financeiro
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_cohort_formadores
DROP POLICY IF EXISTS formacao_cohort_formadores_mutation_policy ON public.formacao_cohort_formadores;
CREATE POLICY formacao_cohort_formadores_insert_policy
ON public.formacao_cohort_formadores
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_formadores_update_policy
ON public.formacao_cohort_formadores
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_formadores_delete_policy
ON public.formacao_cohort_formadores
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_cohort_modulos
DROP POLICY IF EXISTS formacao_cohort_modulos_mutation_policy ON public.formacao_cohort_modulos;
CREATE POLICY formacao_cohort_modulos_insert_policy
ON public.formacao_cohort_modulos
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_modulos_update_policy
ON public.formacao_cohort_modulos
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohort_modulos_delete_policy
ON public.formacao_cohort_modulos
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_cohorts
DROP POLICY IF EXISTS formacao_cohorts_mutation_policy ON public.formacao_cohorts;
CREATE POLICY formacao_cohorts_insert_policy
ON public.formacao_cohorts
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohorts_update_policy
ON public.formacao_cohorts
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cohorts_delete_policy
ON public.formacao_cohorts
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_curso_comercial
DROP POLICY IF EXISTS formacao_curso_comercial_mutation_policy ON public.formacao_curso_comercial;
CREATE POLICY formacao_curso_comercial_insert_policy
ON public.formacao_curso_comercial
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_curso_comercial_update_policy
ON public.formacao_curso_comercial
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_curso_comercial_delete_policy
ON public.formacao_curso_comercial
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_curso_modulos
DROP POLICY IF EXISTS formacao_curso_modulos_mutation_policy ON public.formacao_curso_modulos;
CREATE POLICY formacao_curso_modulos_insert_policy
ON public.formacao_curso_modulos
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_curso_modulos_update_policy
ON public.formacao_curso_modulos
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_curso_modulos_delete_policy
ON public.formacao_curso_modulos
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_cursos
DROP POLICY IF EXISTS formacao_cursos_mutation_policy ON public.formacao_cursos;
CREATE POLICY formacao_cursos_insert_policy
ON public.formacao_cursos
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cursos_update_policy
ON public.formacao_cursos
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_cursos_delete_policy
ON public.formacao_cursos
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_faturas_lote
DROP POLICY IF EXISTS formacao_faturas_lote_mutation_policy ON public.formacao_faturas_lote;
CREATE POLICY formacao_faturas_lote_insert_policy
ON public.formacao_faturas_lote
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_faturas_lote_update_policy
ON public.formacao_faturas_lote
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_faturas_lote_delete_policy
ON public.formacao_faturas_lote
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_faturas_lote_itens
DROP POLICY IF EXISTS formacao_faturas_lote_itens_mutation_policy ON public.formacao_faturas_lote_itens;
CREATE POLICY formacao_faturas_lote_itens_insert_policy
ON public.formacao_faturas_lote_itens
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_faturas_lote_itens_update_policy
ON public.formacao_faturas_lote_itens
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_faturas_lote_itens_delete_policy
ON public.formacao_faturas_lote_itens
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_honorarios_lancamentos
DROP POLICY IF EXISTS formacao_honorarios_mutation_policy ON public.formacao_honorarios_lancamentos;
CREATE POLICY formacao_honorarios_lancamentos_insert_policy
ON public.formacao_honorarios_lancamentos
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_honorarios_lancamentos_update_policy
ON public.formacao_honorarios_lancamentos
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_honorarios_lancamentos_delete_policy
ON public.formacao_honorarios_lancamentos
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

-- formacao_inscricoes
DROP POLICY IF EXISTS formacao_inscricoes_mutation_policy ON public.formacao_inscricoes;
CREATE POLICY formacao_inscricoes_insert_policy
ON public.formacao_inscricoes
FOR INSERT TO public
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_inscricoes_update_policy
ON public.formacao_inscricoes
FOR UPDATE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id))
WITH CHECK ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));
CREATE POLICY formacao_inscricoes_delete_policy
ON public.formacao_inscricoes
FOR DELETE TO public
USING ((escola_id = current_tenant_escola_id()) AND can_access_formacao_backoffice(escola_id));

COMMIT;
