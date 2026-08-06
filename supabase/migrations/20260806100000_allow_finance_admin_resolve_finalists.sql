BEGIN;

-- O Centro de Pendências Pós-Virada é exposto ao admin_financeiro.
-- A autorização da rota já exige configurar_escola; estas guards precisam
-- aceitar o mesmo papel para que a ação não falhe depois do clique.
CREATE OR REPLACE FUNCTION public.finalistas_concluir_arquivar(
  p_escola_id uuid,
  p_reclassificacao_ids uuid[],
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN RAISE EXCEPTION 'AUTH: escola_id inválido'; END IF;
  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor']) THEN RAISE EXCEPTION 'AUTH: permissão negada'; END IF;
  WITH selected AS (
    SELECT mr.id, mr.matricula_id FROM public.matricula_reclassificacoes mr
    WHERE mr.escola_id = p_escola_id AND mr.id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND mr.status = 'aguardando_destino' FOR UPDATE
  ), updated_matriculas AS (
    UPDATE public.matriculas m SET status = 'concluido', ativo = false, numero_matricula = NULL, updated_at = now()
    FROM selected s WHERE m.id = s.matricula_id AND m.escola_id = p_escola_id RETURNING m.id
  )
  UPDATE public.matricula_reclassificacoes mr SET status = 'concluido_arquivado', motivo = coalesce(nullif(trim(p_motivo), ''), mr.motivo), resolvido_por = v_actor, resolvido_em = now(), updated_at = now()
  FROM selected s WHERE mr.id = s.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (p_escola_id, v_actor, 'FINALISTAS_CONCLUIDOS_ARQUIVADOS', 'matricula_reclassificacoes', p_escola_id::text, jsonb_build_object('count', v_count, 'ids', p_reclassificacao_ids, 'motivo', p_motivo, 'at', now()), 'admin');
  RETURN jsonb_build_object('ok', true, 'resolved', v_count, 'status', 'concluido_arquivado');
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalistas_matricular_novo_ciclo(
  p_escola_id uuid,
  p_reclassificacao_ids uuid[],
  p_turma_destino_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id(); v_actor uuid := auth.uid(); v_session uuid; v_capacity integer; v_occupancy integer; v_count integer;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN RAISE EXCEPTION 'AUTH: escola_id inválido'; END IF;
  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor']) THEN RAISE EXCEPTION 'AUTH: permissão negada'; END IF;
  SELECT session_id, capacidade_maxima INTO v_session, v_capacity FROM public.turmas WHERE id = p_turma_destino_id AND escola_id = p_escola_id FOR UPDATE;
  IF v_session IS NULL THEN RAISE EXCEPTION 'DATA: turma destino inválida'; END IF;
  IF EXISTS (SELECT 1 FROM public.matricula_reclassificacoes WHERE escola_id = p_escola_id AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND status = 'aguardando_destino' AND destino_session_id IS DISTINCT FROM v_session) THEN RAISE EXCEPTION 'DATA: turma destino pertence a outro ano letivo'; END IF;
  SELECT count(*)::integer INTO v_count FROM public.matricula_reclassificacoes WHERE escola_id = p_escola_id AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND status = 'aguardando_destino';
  IF v_count = 0 THEN RETURN jsonb_build_object('ok', true, 'resolved', 0, 'status', 'matriculado_novo_ciclo'); END IF;
  SELECT count(*)::integer INTO v_occupancy FROM public.matriculas WHERE escola_id = p_escola_id AND turma_id = p_turma_destino_id AND ativo = true;
  IF v_capacity IS NOT NULL AND v_occupancy + v_count > v_capacity THEN RAISE EXCEPTION 'DATA: turma destino sem vagas para o lote'; END IF;
  UPDATE public.matriculas m SET turma_id = p_turma_destino_id, session_id = v_session, ativo = true, status = 'ativo', updated_at = now()
  FROM public.matricula_reclassificacoes mr WHERE mr.escola_id = p_escola_id AND mr.id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND mr.status = 'aguardando_destino' AND m.id = mr.matricula_id;
  UPDATE public.matricula_reclassificacoes SET destino_turma_id = p_turma_destino_id, status = 'matriculado_novo_ciclo', motivo = coalesce(nullif(trim(p_motivo), ''), motivo), resolvido_por = v_actor, resolvido_em = now(), updated_at = now()
  WHERE escola_id = p_escola_id AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND status = 'aguardando_destino';
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (p_escola_id, v_actor, 'FINALISTAS_MATRICULADOS_NOVO_CICLO', 'matricula_reclassificacoes', p_turma_destino_id::text, jsonb_build_object('count', v_count, 'ids', p_reclassificacao_ids, 'turma_destino_id', p_turma_destino_id, 'at', now()), 'admin');
  RETURN jsonb_build_object('ok', true, 'resolved', v_count, 'turma_destino_id', p_turma_destino_id, 'status', 'matriculado_novo_ciclo');
END;
$function$;

COMMIT;
