BEGIN;

-- 1) Harden mutable search_path warnings (Supabase linter 0011)
-- Keep lookup explicit and predictable for definer/invoker functions.
ALTER FUNCTION public.admin_get_escola_health_metrics() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.admissao_upsert_draft(uuid,uuid,text,jsonb) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.balcao_cancelar_pedido(uuid,text) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.balcao_confirmar_pagamento_intent(uuid,text,text,text,text,jsonb) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.balcao_criar_pedido_e_decidir(text,uuid,jsonb) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.block_escola_slug_changes() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.block_legacy_rotinas_write() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.calcular_media_trimestral(jsonb,jsonb) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.can_bypass_pauta_lock(uuid,uuid,uuid,uuid) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.ensure_curriculo_published_for_turma() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.ensure_escola_user_professor() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.ensure_horario_versao(uuid,uuid,uuid,text) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.fiscal_prevent_update_emitido() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.fiscal_touch_updated_at() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.fn_formacao_promote_staging_to_official() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.generate_escola_slug(text,uuid) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.guard_notas_when_turma_fechada() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.map_admin_activity_family(text) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.provisionar_escola_from_onboarding(uuid,uuid) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.publish_horario_versao(uuid,uuid,uuid) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.recalc_escola_financeiro_totals(uuid,date) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.set_escolas_slug() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.set_updated_at_curso_professor_responsavel() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.slugify_escola_nome(text) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.sum_component_pesos(jsonb) SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.sync_escola_users_tenant_type() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_curriculum_recalc_status() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_sync_escola_plano_from_assinatura() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_sync_professor_escola_user() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_validate_quadro_curriculo_cohesion() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_validate_quadro_docente_alocacao() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_validate_quadro_published_conflicts() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trg_validate_quadro_tenant_cohesion() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.trigger_archive_document_outbox() SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.update_escola_slug(uuid,text) SET search_path = pg_catalog, public, auth, extensions;

-- 2) Tighten permissive INSERT policy (Supabase linter 0024)
-- Preserve public onboarding intake while requiring a minimally valid request envelope.
DROP POLICY IF EXISTS onboarding_insert_public ON public.onboarding_requests;
CREATE POLICY onboarding_insert_public
ON public.onboarding_requests
FOR INSERT
TO public
WITH CHECK (
  status = 'pendente'
  AND length(btrim(coalesce(escola_nome, ''))) >= 3
  AND length(btrim(coalesce(escola_nome, ''))) <= 200
);

COMMIT;
