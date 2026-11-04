-- Transferência integral de uma turma em UMA transação Postgres.
-- Não cria nova matrícula: preserva as chaves académicas/financeiras.
-- A migração fica na branch; NÃO aplicar diretamente à produção.
BEGIN;

CREATE OR REPLACE FUNCTION public.transferir_turma_em_lote(
  p_turma_origem_id uuid,
  p_turma_destino_id uuid,
  p_ano_letivo_id uuid,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_origem public.turmas%ROWTYPE;
  v_destino public.turmas%ROWTYPE;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_locked_turmas integer := 0;
  v_matriculas uuid[];
  v_quantidade integer := 0;
  v_ocupacao_destino integer := 0;
  v_atualizadas integer := 0;
BEGIN
  -- SECURITY DEFINER nunca pode confiar em uma escola enviada pelo cliente.
  IF v_actor IS NULL OR v_escola_id IS NULL
     OR NOT coalesce(public.user_has_role_in_school(
       v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']
     ), false) THEN
    RAISE EXCEPTION 'AUTH: Sem permissão para transferir matrículas.';
  END IF;
  IF p_turma_origem_id IS NULL OR p_turma_destino_id IS NULL
     OR p_turma_origem_id = p_turma_destino_id THEN
    RAISE EXCEPTION 'DATA: Escolha duas turmas diferentes.';
  END IF;
  IF p_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Informe o ano letivo da operação.';
  END IF;
  IF v_motivo IS NULL OR char_length(v_motivo) < 10
     OR char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'DATA: O motivo deve conter entre 10 e 300 caracteres.';
  END IF;

  -- Mesmo padrão de bloqueio da RPC individual (UUID crescente).
  -- Impede concorrência entre transferências que sigam esse contrato.
  PERFORM 1
  FROM public.turmas t
  WHERE t.escola_id = v_escola_id
    AND t.id IN (p_turma_origem_id, p_turma_destino_id)
  ORDER BY t.id
  FOR UPDATE;
  GET DIAGNOSTICS v_locked_turmas = ROW_COUNT;
  IF v_locked_turmas <> 2 THEN
    RAISE EXCEPTION 'DATA: Turma não encontrada nesta escola.';
  END IF;

  SELECT * INTO v_origem FROM public.turmas
  WHERE id = p_turma_origem_id AND escola_id = v_escola_id;
  SELECT * INTO v_destino FROM public.turmas
  WHERE id = p_turma_destino_id AND escola_id = v_escola_id;

  IF v_origem.status_validacao IS DISTINCT FROM 'ativo'
     OR v_destino.status_validacao IS DISTINCT FROM 'ativo'
     OR v_origem.status_fecho IS DISTINCT FROM 'ABERTO'
     OR v_destino.status_fecho IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'DATA: As turmas devem estar ativas e abertas.';
  END IF;

  IF v_origem.session_id IS NULL
     OR v_origem.session_id IS DISTINCT FROM p_ano_letivo_id
     OR v_destino.session_id IS DISTINCT FROM p_ano_letivo_id
     OR v_origem.ano_letivo_id IS DISTINCT FROM p_ano_letivo_id
     OR v_destino.ano_letivo_id IS DISTINCT FROM p_ano_letivo_id
     OR v_origem.ano_letivo IS DISTINCT FROM v_destino.ano_letivo THEN
    RAISE EXCEPTION 'DATA: As turmas devem pertencer ao mesmo ano letivo.';
  END IF;

  IF v_origem.curso_id IS DISTINCT FROM v_destino.curso_id
     OR v_origem.classe_id IS DISTINCT FROM v_destino.classe_id THEN
    RAISE EXCEPTION 'DATA: A transferência exige o mesmo curso e classe.';
  END IF;

  -- Bloquear as matrículas de origem em ordem estável. Todo o grupo é
  -- validado antes de qualquer UPDATE; nenhuma alteração parcial é aceite.
  SELECT coalesce(array_agg(locked.id ORDER BY locked.id), '{}'::uuid[])
  INTO v_matriculas
  FROM (
    SELECT m.id
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.turma_id = p_turma_origem_id
      AND m.session_id = p_ano_letivo_id
      AND m.ativo IS TRUE
      AND public.canonicalize_matricula_status_text(m.status) = 'ativo'
    ORDER BY m.id
    FOR UPDATE
  ) locked;

  v_quantidade := cardinality(v_matriculas);
  IF v_quantidade = 0 THEN
    RAISE EXCEPTION 'DATA: A turma não possui matrículas ativas para transferir.';
  END IF;

  -- Notas, exames e frequência podem referir avaliações/disciplina/turma
  -- antigas. O vínculo da matrícula sozinho não reconcilia esses registos.
  -- Até existir uma transferência académica específica, falhar sem escrita.
  IF EXISTS (
    SELECT 1 FROM public.notas n
    WHERE n.escola_id = v_escola_id AND n.matricula_id = ANY(v_matriculas)
  ) OR EXISTS (
    SELECT 1 FROM public.exame_resultados er
    WHERE er.escola_id = v_escola_id AND er.matricula_id = ANY(v_matriculas)
  ) OR EXISTS (
    SELECT 1 FROM public.frequencias f
    WHERE f.escola_id = v_escola_id AND f.matricula_id = ANY(v_matriculas)
  ) OR EXISTS (
    SELECT 1 FROM public.frequencia_status_periodo fp
    WHERE fp.escola_id = v_escola_id AND fp.matricula_id = ANY(v_matriculas)
  ) OR EXISTS (
    SELECT 1 FROM public.presencas p
    JOIN public.matriculas m ON m.aluno_id = p.aluno_id
       AND m.escola_id = p.escola_id
    WHERE p.escola_id = v_escola_id
      AND p.turma_id = p_turma_origem_id
      AND m.id = ANY(v_matriculas)
  ) THEN
    RAISE EXCEPTION 'DATA: Existem notas, exames ou frequência na turma de origem. A transferência em massa requer conciliação académica para preservar as pautas.';
  END IF;

  IF v_destino.capacidade_maxima IS NULL OR v_destino.capacidade_maxima <= 0 THEN
    RAISE EXCEPTION 'DATA: Defina uma capacidade válida para a turma de destino.';
  END IF;
  SELECT count(*) INTO v_ocupacao_destino
  FROM public.matriculas m
  WHERE m.escola_id = v_escola_id
    AND m.turma_id = p_turma_destino_id
    AND m.session_id = p_ano_letivo_id
    AND m.ativo IS TRUE
    AND public.canonicalize_matricula_status_text(m.status) = 'ativo';

  IF v_ocupacao_destino + v_quantidade > v_destino.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: Turma destino sem vagas suficientes (% livres, % alunos).',
      v_destino.capacidade_maxima - v_ocupacao_destino, v_quantidade;
  END IF;

  UPDATE public.matriculas m
  SET turma_id = p_turma_destino_id,
      updated_at = now(),
      updated_by = v_actor
  WHERE m.id = ANY (v_matriculas)
    AND m.escola_id = v_escola_id
    AND m.session_id = p_ano_letivo_id
    AND m.turma_id = p_turma_origem_id
    AND m.ativo IS TRUE
    AND public.canonicalize_matricula_status_text(m.status) = 'ativo';
  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
  IF v_atualizadas <> v_quantidade THEN
    RAISE EXCEPTION 'CONFLICT: As matrículas mudaram durante a operação. Nenhuma alteração foi gravada.';
  END IF;

  -- O histórico de cada transferência é gravado na mesma transação.
  INSERT INTO public.audit_logs (
    escola_id, actor_id, action, entity, entity_id, portal,
    details, before, after
  )
  SELECT v_escola_id, v_actor, 'MATRICULA_TRANSFERIDA',
         'matriculas', m.id::text, 'secretaria',
         jsonb_build_object('tipo', 'transferencia_turma_em_lote', 'motivo', v_motivo,
                            'quantidade', v_quantidade),
         jsonb_build_object('turma_id', p_turma_origem_id,
                            'session_id', p_ano_letivo_id),
         jsonb_build_object('turma_id', p_turma_destino_id,
                            'session_id', p_ano_letivo_id)
  FROM unnest(v_matriculas) AS m(id);

  RETURN jsonb_build_object(
    'transferred', v_quantidade,
    'source_turma_id', p_turma_origem_id,
    'target_turma_id', p_turma_destino_id,
    'ano_letivo_id', p_ano_letivo_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transferir_turma_em_lote(uuid,uuid,uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_turma_em_lote(uuid,uuid,uuid,text)
  TO authenticated;

COMMIT;
