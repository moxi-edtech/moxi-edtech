BEGIN;

-- =================================================================
-- ATUALIZAÇÃO RPC: `finalizar_matricula_anual`
--
-- OBJETIVO:
-- 1. Integrar a geração do histórico anual ao fluxo de finalização
--    da matrícula, garantindo consistência.
-- =================================================================

CREATE OR REPLACE FUNCTION public.finalizar_matricula_anual(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_novo_status text,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_matricula record;
  v_canonical_status text;
  v_missing_grades_count int;
BEGIN
  -- 1. Validação de Permissões
  SELECT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  -- 2. Validar Matrícula
  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id FOR UPDATE;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  -- 3. Validar e Canonicalizar o Novo Status
  v_canonical_status := public.canonicalize_matricula_status_text(p_novo_status);
  IF v_canonical_status NOT IN ('concluido', 'reprovado', 'transferido', 'inativo') THEN
    RAISE EXCEPTION 'LOGIC: Status final inválido. Use concluido, reprovado, transferido ou inativo.';
  END IF;

  -- 4. Validação de Negócio: Não pode concluir se faltarem notas.
  IF v_canonical_status = 'concluido' THEN
    SELECT SUM(b.missing_count) INTO v_missing_grades_count
    FROM public.vw_boletim_por_matricula_legacy b -- Usando a view legada para o cálculo
    WHERE b.matricula_id = p_matricula_id;

    IF v_missing_grades_count > 0 THEN
      RAISE EXCEPTION 'LOGIC: Não é possível concluir a matrícula. Existem % notas em falta.', v_missing_grades_count;
    END IF;
  END IF;

  -- 5. Atualizar a Matrícula
  UPDATE public.matriculas
  SET status = v_canonical_status, updated_at = now()
  WHERE id = p_matricula_id;

  -- 6. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    p_escola_id,
    v_actor_id,
    'MATRICULA_STATUS_FINALIZADO',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object('motivo', p_motivo),
    jsonb_build_object('status', v_matricula.status),
    jsonb_build_object('status', v_canonical_status)
  );

  -- 7. Gerar o Histórico Acadêmico Consolidado
  IF v_canonical_status IN ('concluido', 'reprovado') THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);
  END IF;

END;
$$;

COMMIT;
