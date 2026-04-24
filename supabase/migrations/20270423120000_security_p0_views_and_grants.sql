BEGIN;

-- P0-1: Remove auth.users dependency and scope admin activity feed to tenant/super-admin context.
CREATE OR REPLACE VIEW public.vw_admin_activity_feed_enriched AS
SELECT
  e.id,
  e.escola_id,
  e.occurred_at,
  e.event_family,
  e.event_type,
  COALESCE(
    NULLIF(p.nome, ''),
    NULLIF(e.payload ->> 'actor_name', ''),
    'Sistema'
  ) AS actor_name,
  COALESCE(
    NULLIF(e.payload ->> 'headline', ''),
    CASE
      WHEN e.event_type = 'PAGAMENTO_REGISTRADO' THEN 'Pagamento confirmado'
      WHEN e.event_type = 'NOTA_LANCADA_BATCH' THEN 'Lançamento de notas concluído'
      WHEN e.event_type = 'DOCUMENTO_EMITIDO' THEN 'Documento emitido'
      WHEN e.event_type LIKE 'MATRICULA_%' THEN 'Actualização de matrícula'
      WHEN e.event_type LIKE 'ADMISSAO_%' THEN 'Actualização de admissão'
      ELSE initcap(replace(lower(e.event_type), '_', ' '))
    END
  ) AS headline,
  COALESCE(
    NULLIF(e.payload ->> 'subline', ''),
    e.payload ->> 'turma_nome',
    e.payload ->> 'aluno_nome',
    e.payload ->> 'documento_nome'
  ) AS subline,
  NULLIF(e.payload ->> 'valor_numeric', '')::numeric(14,2) AS amount_kz,
  NULLIF(COALESCE(e.payload ->> 'turma_nome', t.nome), '') AS turma_nome,
  NULLIF(COALESCE(e.payload ->> 'aluno_nome', a.nome_completo, a.nome), '') AS aluno_nome,
  e.payload
FROM public.admin_activity_events e
LEFT JOIN public.profiles p ON p.user_id = e.actor_id
LEFT JOIN public.alunos a ON a.id::text = COALESCE(e.payload ->> 'aluno_id', e.entity_id)
LEFT JOIN public.turmas t ON t.id::text = COALESCE(e.payload ->> 'turma_id', e.payload #>> '{turma,id}')
WHERE e.escola_id = public.current_tenant_escola_id()
   OR public.is_super_or_global_admin();

-- P0-2: Restrict escolas_view to super/global admins only.
CREATE OR REPLACE VIEW public.escolas_view AS
SELECT
  e.id,
  e.nome,
  e.status,
  e.plano_atual,
  e.plano_atual::text AS plano,
  (
    SELECT max(al.created_at)::timestamp without time zone
    FROM public.audit_logs al
    WHERE al.escola_id = e.id
  ) AS last_access,
  COALESCE(a.total_alunos, 0) AS total_alunos,
  COALESCE(pf.total_professores, 0) AS total_professores,
  e.endereco AS cidade,
  NULL::text AS estado
FROM public.escolas e
LEFT JOIN (
  SELECT alunos.escola_id, count(*)::integer AS total_alunos
  FROM public.alunos
  GROUP BY alunos.escola_id
) a ON a.escola_id = e.id
LEFT JOIN (
  SELECT p.escola_id, count(*)::integer AS total_professores
  FROM public.profiles p
  WHERE p.role = 'professor'::public.user_role
  GROUP BY p.escola_id
) pf ON pf.escola_id = e.id
WHERE public.is_super_or_global_admin();

-- P0-3: Restrict historico snapshot status to tenant/super-admin context.
CREATE OR REPLACE VIEW public.vw_historico_snapshot_status AS
SELECT
  hsl.escola_id,
  hsl.ano_letivo_id,
  hsl.matricula_id,
  hsl.historico_ano_id,
  hsl.status,
  hsl.lock_run_id,
  hsl.lock_step,
  hsl.lock_reason,
  hsl.locked_at,
  hsl.reopened_at,
  hsl.reopened_by,
  hsl.reopened_reason,
  hsl.allow_reopen,
  hsl.updated_at
FROM public.historico_snapshot_locks hsl
WHERE hsl.escola_id = public.current_tenant_escola_id()
   OR public.is_super_or_global_admin();

-- P0-4: Ensure flagged public views run as SECURITY INVOKER.
ALTER VIEW public.vw_top_cursos_media SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_audit_metrics SET (security_invoker = true);
ALTER VIEW public.vw_top_turmas_hoje SET (security_invoker = true);
ALTER VIEW public.vw_formacao_margem_por_edicao SET (security_invoker = true);
ALTER VIEW public.vw_formacao_honorarios_formador SET (security_invoker = true);
ALTER VIEW public.vw_admin_activity_feed_enriched SET (security_invoker = true);
ALTER VIEW public.escolas_view SET (security_invoker = true);
ALTER VIEW public.vw_rotinas_compat SET (security_invoker = true);
ALTER VIEW public.vw_historico_snapshot_status SET (security_invoker = true);
ALTER VIEW public.vw_formacao_faturas_formando SET (security_invoker = true);
ALTER VIEW public.vw_escola_cursos_stats SET (security_invoker = true);
ALTER VIEW public.vw_boletim_por_matricula SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_escola_metrics SET (security_invoker = true);
ALTER VIEW public.vw_formacao_cohorts_lotacao SET (security_invoker = true);
ALTER VIEW public.vw_formacao_cohorts_overview SET (security_invoker = true);
ALTER VIEW public.vw_formacao_inadimplencia_resumo SET (security_invoker = true);
ALTER VIEW public.vw_escola_info SET (security_invoker = true);
ALTER VIEW public.vw_freq_por_turma_dia SET (security_invoker = true);

-- P0-5: Tighten grants on flagged views.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'vw_admin_activity_feed_enriched','vw_top_cursos_media','vw_super_admin_audit_metrics',
    'vw_top_turmas_hoje','vw_formacao_margem_por_edicao','vw_formacao_honorarios_formador',
    'escolas_view','vw_historico_snapshot_status','vw_formacao_faturas_formando',
    'vw_escola_cursos_stats','vw_boletim_por_matricula','vw_super_admin_escola_metrics',
    'vw_formacao_cohorts_lotacao','vw_formacao_cohorts_overview','vw_formacao_inadimplencia_resumo',
    'vw_escola_info','vw_freq_por_turma_dia'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, service_role', v);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated, service_role', v);
  END LOOP;
END $$;

-- Internal compatibility view: service role only.
REVOKE ALL ON TABLE public.vw_rotinas_compat FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.vw_rotinas_compat TO service_role;

COMMIT;
