-- ======================================================================
--  FUNÇÃO: rematricula_em_massa
--  - Rematricula alunos ativos da turma de origem para a turma de destino
--  - Deduplica por sessão (não cria se já houver matrícula ativa na sessão destino)
--  - Atualiza matrículas antigas dos inseridos para 'transferido'
--  - Retorna métricas (inserted, skipped, errors)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.rematricula_em_massa(
  p_escola_id        uuid,
  p_origem_turma_id  uuid,
  p_destino_turma_id uuid
)
RETURNS TABLE(inserted integer, skipped integer, errors jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dest_session uuid;
  v_errs jsonb := '[]'::jsonb;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  -- Validar turmas & escola
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_origem_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma de origem não pertence à escola';
  END IF;
  SELECT t.session_id INTO v_dest_session FROM public.turmas t WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id LIMIT 1;
  IF v_dest_session IS NULL THEN
    RAISE EXCEPTION 'Turma de destino inválida ou sem sessão vinculada';
  END IF;

  -- Inserir matrículas para quem ainda não está ativo na sessão destino
  WITH origem_alunos AS (
    SELECT DISTINCT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id  = p_origem_turma_id
      AND m.status IN ('ativo','ativa','active')
  ), ja_ativos_dest AS (
    SELECT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id  = p_escola_id
      AND m.session_id = v_dest_session
      AND m.status IN ('ativo','ativa','active')
  ), candidatos AS (
    SELECT o.aluno_id,
           CASE WHEN j.aluno_id IS NOT NULL THEN true ELSE false END AS exists_dest
    FROM origem_alunos o
    LEFT JOIN ja_ativos_dest j ON j.aluno_id = o.aluno_id
  )
  INSERT INTO public.matriculas (id, escola_id, aluno_id, turma_id, session_id, status, ativo, created_at)
  SELECT gen_random_uuid(), p_escola_id, c.aluno_id, p_destino_turma_id, v_dest_session, 'ativo', true, now()
  FROM candidatos c
  WHERE c.exists_dest = false;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- skipped = total origem - inserted
  SELECT COALESCE(COUNT(*),0) - COALESCE(v_inserted,0)
    INTO v_skipped
  FROM (
    SELECT DISTINCT m.aluno_id FROM public.matriculas m
    WHERE m.escola_id = p_escola_id AND m.turma_id = p_origem_turma_id AND m.status IN ('ativo','ativa','active')
  ) x;

  -- Atualiza matrículas antigas para transferido somente dos inseridos
  UPDATE public.matriculas m
     SET status = 'transferido', updated_at = now()
   WHERE m.escola_id = p_escola_id
     AND m.turma_id  = p_origem_turma_id
     AND m.aluno_id IN (
       SELECT m2.aluno_id FROM public.matriculas m2
       WHERE m2.escola_id = p_escola_id AND m2.turma_id = p_destino_turma_id AND m2.session_id = v_dest_session
     );

  RETURN QUERY SELECT COALESCE(v_inserted,0) AS inserted,
                      COALESCE(v_skipped,0)  AS skipped,
                      v_errs                 AS errors;
END;
$$;

