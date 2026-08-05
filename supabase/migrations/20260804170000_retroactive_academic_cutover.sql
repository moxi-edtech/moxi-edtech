BEGIN;

ALTER TABLE public.anos_letivos
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_com_pendencias boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.cutover_ano_letivo_retroativo(
  p_escola_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_from_year integer;
  v_to_year integer;
  v_promoted integer := 0;
  v_debtors integer := 0;
  v_existing integer := 0;
  v_turma record;
  v_source record;
  v_destination_id uuid;
  v_balance numeric;
BEGIN
  IF v_tenant_id IS NULL OR v_tenant_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','diretor']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissao negada';
  END IF;

  SELECT ano INTO v_from_year FROM public.anos_letivos
  WHERE id = p_from_session_id AND escola_id = p_escola_id FOR UPDATE;
  SELECT ano INTO v_to_year FROM public.anos_letivos
  WHERE id = p_to_session_id AND escola_id = p_escola_id FOR UPDATE;

  IF v_from_year IS NULL OR v_to_year IS NULL OR v_to_year <= v_from_year THEN
    RAISE EXCEPTION 'VALIDATION: anos letivos de origem/destino invalidos';
  END IF;

  FOR v_turma IN
    SELECT old_turma.id AS origem_id, next_turma.id AS destino_id
    FROM public.turmas old_turma
    JOIN public.turmas next_turma
      ON next_turma.escola_id = p_escola_id
     AND next_turma.session_id = p_to_session_id
     AND next_turma.curso_id = old_turma.curso_id
     AND next_turma.classe_num = old_turma.classe_num + 1
     AND next_turma.turno IS NOT DISTINCT FROM old_turma.turno
     AND next_turma.letra IS NOT DISTINCT FROM old_turma.letra
    WHERE old_turma.escola_id = p_escola_id
      AND old_turma.session_id = p_from_session_id
  LOOP
    v_destination_id := v_turma.destino_id;

    FOR v_source IN
      SELECT m.*
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = v_turma.origem_id
        AND m.session_id = p_from_session_id
        AND lower(coalesce(m.status, '')) IN ('ativo','ativa','active','concluido','concluida','aprovado','aprovada','reprovado','reprovada','reprovado_por_faltas')
    LOOP
      SELECT COALESCE(SUM(
        CASE WHEN lower(coalesce(fl.tipo, '')) IN ('debito','débito') THEN COALESCE(fl.valor, 0)
             ELSE -COALESCE(fl.valor, 0) END
      ), 0)
      INTO v_balance
      FROM public.financeiro_ledger fl
      WHERE fl.escola_id = p_escola_id
        AND fl.aluno_id = v_source.aluno_id;

      IF v_balance > 0 THEN
        UPDATE public.matriculas
        SET status = 'pendente', ativo = false, numero_matricula = NULL, updated_at = now()
        WHERE id = v_source.id;
        v_debtors := v_debtors + 1;
        CONTINUE;
      END IF;

      SELECT count(*) INTO v_existing
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.aluno_id = v_source.aluno_id
        AND m.session_id = p_to_session_id;

      IF v_existing > 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
        ativo, numero_matricula, data_matricula, created_at, updated_at
      ) VALUES (
        p_escola_id, v_source.aluno_id, v_destination_id, p_to_session_id, v_to_year, 'ativo',
        true,
        public.next_matricula_number(p_escola_id)::text,
        CURRENT_DATE, now(), now()
      );

      UPDATE public.matriculas
      SET status = 'transferido', ativo = false, updated_at = now()
      WHERE id = v_source.id;
      v_promoted := v_promoted + 1;
    END LOOP;
  END LOOP;

  UPDATE public.anos_letivos
  SET ativo = false,
      arquivado_em = now(),
      arquivado_com_pendencias = true,
      arquivado_por = v_actor_id
  WHERE id = p_from_session_id AND escola_id = p_escola_id;

  UPDATE public.anos_letivos
  SET ativo = true
  WHERE id = p_to_session_id AND escola_id = p_escola_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ANO_LETIVO_CUTOVER_RETROATIVO', 'anos_letivos', p_to_session_id::text,
    jsonb_build_object(
      'from_session_id', p_from_session_id,
      'to_session_id', p_to_session_id,
      'from_ano', v_from_year,
      'to_ano', v_to_year,
      'promoted', v_promoted,
      'debtors_held', v_debtors,
      'academic_pending_data_allowed', true,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'retroactive_pending',
    'from_session_id', p_from_session_id,
    'to_session_id', p_to_session_id,
    'promoted', v_promoted,
    'debtors_held', v_debtors,
    'academic_pending_data_allowed', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cutover_ano_letivo_retroativo(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cutover_ano_letivo_retroativo(uuid, uuid, uuid) TO authenticated;

COMMIT;
