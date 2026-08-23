BEGIN;

-- O portal deve aceitar a matrícula histórica encerrada como origem.
-- A matrícula do ano destino só se torna oficial após a confirmação financeira.
-- Reutilizamos as funções existentes para não criar um segundo contrato RPC.
-- Esta migration precisa ser posterior às migrations 202706/202708 que redefinem
-- estas RPCs; caso contrário, uma instalação limpa perderia estes guards.
DO $$
DECLARE
  v_identity text;
  v_definition text;
  v_after_source text;
  v_after_academic text;
  v_after_finance text;
  v_updated text;
  v_found integer := 0;
BEGIN
  FOR v_definition, v_identity IN
    SELECT pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        (p.proname = 'aluno_iniciar_rematricula' AND pg_get_function_identity_arguments(p.oid) = 'p_matricula_id uuid, p_servicos_ids uuid[]')
        OR
        (p.proname = 'aluno_confirmar_rematricula' AND pg_get_function_identity_arguments(p.oid) = 'p_matricula_id uuid')
      )
  LOOP
    v_found := v_found + 1;
    v_updated := v_definition;

    v_after_source := regexp_replace(
      v_updated,
      $pattern$AND m\.status IN \('ativo', 'ativa', 'active'(, 'transferido')?\)$pattern$,
      $replacement$AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'concluido', 'reprovado', 'transferido')$replacement$,
      1,
      1
    );

    IF v_after_source = v_updated THEN
      RAISE EXCEPTION 'DATA: guard de matrícula de origem não encontrado na função %', v_identity;
    END IF;

    -- O guard fica dentro da RPC porque endpoints HTTP não são a única forma de
    -- uma sessão authenticated invocar uma função pública do Supabase.
    v_after_academic := regexp_replace(
      v_after_source,
      $pattern$IF v_mat\.id IS NULL THEN\s+RAISE EXCEPTION 'DATA: matrícula atual não encontrada';\s+END IF;$pattern$,
      $replacement$IF v_mat.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula de origem não encontrada';
  END IF;

  IF COALESCE(
    public.resolve_raa_progression_for_matricula(v_escola_id, v_mat.id)->>'decision',
    'pendente'
  ) IN ('pendente', 'recurso', 'concluiu')
     OR COALESCE(
       (public.resolve_raa_progression_for_matricula(v_escola_id, v_mat.id)->>'efetivacao_matricula_bloqueada')::boolean,
       false
     ) THEN
    RAISE EXCEPTION 'ACADEMICO: situação académica não autoriza rematrícula';
  END IF;$replacement$,
      1,
      1
    );

    IF v_after_academic = v_after_source THEN
      RAISE EXCEPTION 'DATA: ponto de inserção do guard RAA não encontrado na função %', v_identity;
    END IF;

    v_after_finance := regexp_replace(
      v_after_academic,
      $pattern$AND men\.aluno_id = v_mat\.aluno_id\s+AND men\.status IN \('pendente', 'atrasado'\)$pattern$,
      $replacement$AND men.aluno_id = v_mat.aluno_id
      AND (men.matricula_id = v_mat.id OR men.ano_referencia = v_mat.ano_letivo)
        AND men.status IN ('pendente', 'atrasado', 'pago_parcial')$replacement$,
      1,
      1
    );

    IF v_after_finance = v_after_academic THEN
      RAISE EXCEPTION 'DATA: guard financeiro não encontrado na função %', v_identity;
    END IF;

    -- O portal suporta aluno e encarregado. A autorização da RPC deve espelhar
    -- resolveAuthorizedStudentIds, inclusive o vínculo por e-mail autenticado.
    v_updated := regexp_replace(
      v_after_finance,
      $pattern$AND \(a\.profile_id = v_uid OR a\.usuario_auth_id = v_uid\);$pattern$,
      $replacement$AND (
      a.profile_id = v_uid
      OR a.usuario_auth_id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.aluno_encarregados ae
        JOIN public.encarregados e
          ON e.id = ae.encarregado_id
         AND e.escola_id = ae.escola_id
        WHERE ae.escola_id = v_escola_id
          AND ae.aluno_id = v_mat.aluno_id
          AND lower(trim(e.email)) = lower(trim(COALESCE(auth.jwt()->>'email', '')))
      )
    );$replacement$,
      1,
      1
    );

    IF v_updated = v_after_finance THEN
      RAISE EXCEPTION 'DATA: guard de autorização do aluno não encontrado na função %', v_identity;
    END IF;

    EXECUTE v_updated;
  END LOOP;

  IF v_found <> 2 THEN
    RAISE EXCEPTION 'DATA: esperadas 2 funções de rematrícula do portal, encontradas %', v_found;
  END IF;
END;
$$;

COMMIT;
