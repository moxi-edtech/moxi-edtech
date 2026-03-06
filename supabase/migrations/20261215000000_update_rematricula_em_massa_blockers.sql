BEGIN;

DROP FUNCTION IF EXISTS public.rematricula_em_massa(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rematricula_em_massa(
  p_escola_id uuid,
  p_origem_turma_id uuid,
  p_destino_turma_id uuid
)
RETURNS TABLE(inserted jsonb, skipped jsonb, errors jsonb)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_dest_session uuid;
  v_errs jsonb := '[]'::jsonb;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_bloquear_inadimplentes boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_origem_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma de origem não pertence à escola';
  END IF;
  SELECT t.session_id INTO v_dest_session FROM public.turmas t WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id LIMIT 1;
  IF v_dest_session IS NULL THEN
    RAISE EXCEPTION 'Turma de destino inválida ou sem sessão vinculada';
  END IF;

  SELECT COALESCE(cf.bloquear_inadimplentes, false)
    INTO v_bloquear_inadimplentes
  FROM public.configuracoes_financeiro cf
  WHERE cf.escola_id = p_escola_id
  LIMIT 1;

  WITH origem_alunos AS (
    SELECT m.aluno_id, m.id AS matricula_id, m.status, m.ano_letivo
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id  = p_origem_turma_id
      AND m.status IN ('ativo','ativa','active','reprovado','reprovada','reprovado_por_faltas')
  ), ja_ativos_dest AS (
    SELECT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id  = p_escola_id
      AND m.session_id = v_dest_session
      AND m.status IN ('ativo','ativa','active')
  ), candidatos AS (
    SELECT
      o.aluno_id,
      o.matricula_id,
      o.ano_letivo,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN j.aluno_id IS NOT NULL THEN 'ja_ativo' END,
        CASE WHEN v_bloquear_inadimplentes AND EXISTS (
          SELECT 1
          FROM public.mensalidades ms
          WHERE ms.escola_id = p_escola_id
            AND ms.aluno_id = o.aluno_id
            AND ms.ano_referencia = o.ano_letivo
            AND ms.status IN ('pendente','pago_parcial')
            AND ms.data_vencimento < CURRENT_DATE
        ) THEN 'inadimplencia' END,
        CASE WHEN lower(coalesce(o.status,'')) IN ('reprovado','reprovada','reprovado_por_faltas') THEN 'reprovacao' END
      ], NULL) AS motivos
    FROM origem_alunos o
    LEFT JOIN ja_ativos_dest j ON j.aluno_id = o.aluno_id
  ), to_insert AS (
    SELECT * FROM candidatos
    WHERE array_length(motivos, 1) IS NULL
  ), ins AS (
    INSERT INTO public.matriculas (id, escola_id, aluno_id, turma_id, session_id, status, ativo, created_at)
    SELECT gen_random_uuid(), p_escola_id, c.aluno_id, p_destino_turma_id, v_dest_session, 'ativo', true, now()
    FROM to_insert c
    RETURNING id, aluno_id
  )
  SELECT COALESCE(
      jsonb_agg(jsonb_build_object('matricula_id', i.id, 'aluno_id', i.aluno_id)),
      '[]'::jsonb
    )
    INTO v_inserted
  FROM ins i;

  SELECT COALESCE(
      jsonb_agg(jsonb_build_object('matricula_id', c.matricula_id, 'aluno_id', c.aluno_id, 'motivos', c.motivos)),
      '[]'::jsonb
    )
    INTO v_skipped
  FROM candidatos c
  WHERE array_length(c.motivos, 1) IS NOT NULL;

  UPDATE public.matriculas m
     SET status = 'transferido', updated_at = now()
   WHERE m.escola_id = p_escola_id
     AND m.turma_id  = p_origem_turma_id
     AND m.aluno_id IN (SELECT aluno_id FROM to_insert);

  RETURN QUERY SELECT v_inserted AS inserted,
                      v_skipped  AS skipped,
                      v_errs     AS errors;
END;
$$;

GRANT ALL ON FUNCTION public.rematricula_em_massa(uuid, uuid, uuid) TO anon, authenticated, service_role;

COMMIT;
