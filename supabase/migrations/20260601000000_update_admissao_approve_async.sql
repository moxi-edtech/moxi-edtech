-- 20260601000000_update_admissao_approve_async.sql
BEGIN;

-- Update admissao_approve to force 'aguardando_pagamento' and set 48h reservation
CREATE OR REPLACE FUNCTION public.admissao_approve(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_observacao text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
  v_target_status text := 'aguardando_pagamento';
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  -- Se já estiver matriculado, não faz nada
  IF v_cand.status = 'matriculado' THEN
    RETURN p_candidatura_id;
  END IF;

  -- Se já estiver aguardando pagamento, podemos apenas atualizar a observação ou a reserva se necessário, 
  -- mas por enquanto vamos permitir re-aprovar para resetar o cronômetro de 48h se a secretaria quiser.
  
  IF v_cand.status NOT IN ('submetida', 'em_analise', 'pendente', 'aguardando_pagamento', 'aprovada') THEN
    RAISE EXCEPTION 'Transição inválida: status atual = %', v_cand.status;
  END IF;

  IF v_cand.curso_id IS NULL OR v_cand.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'Candidatura incompleta para aprovação';
  END IF;

  -- Validações de Classe e Turma (mantidas da versão anterior)
  IF v_cand.classe_id IS NOT NULL THEN
    SELECT cl.escola_id, cl.curso_id
    INTO v_classe
    FROM public.classes cl
    WHERE cl.id = v_cand.classe_id;

    IF v_classe.escola_id <> v_tenant THEN
      RAISE EXCEPTION 'Classe inválida para esta escola';
    END IF;

    IF v_classe.curso_id IS NOT NULL AND v_classe.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Classe não pertence ao curso selecionado';
    END IF;
  END IF;

  IF v_cand.turma_preferencial_id IS NOT NULL THEN
    SELECT t.escola_id, t.curso_id, t.classe_id, t.ano_letivo
    INTO v_turma
    FROM public.turmas t
    WHERE t.id = v_cand.turma_preferencial_id;

    IF v_turma.escola_id <> v_tenant THEN
      RAISE EXCEPTION 'Turma preferencial inválida para esta escola';
    END IF;

    IF v_turma.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro curso';
    END IF;

    IF v_cand.classe_id IS NOT NULL AND v_turma.classe_id <> v_cand.classe_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outra classe';
    END IF;

    IF v_turma.ano_letivo <> v_cand.ano_letivo THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro ano letivo';
    END IF;
  END IF;

  -- Log de alteração de status
  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_target_status,
    p_observacao
  );

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_target_status,
    expires_at = now() + interval '48 hours', -- Reserva de 48 horas
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'aprovacao_obs', p_observacao,
        'aprovada_at', now(),
        'reserva_expira_at', (now() + interval '48 hours')
      ),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  RETURN p_candidatura_id;
END;
$$;

COMMIT;
