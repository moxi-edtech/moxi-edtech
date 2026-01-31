BEGIN;

-- =================================================================
-- MIGRATION: Trava de Período Unificada (Frequências e Notas)
--
-- OBJETIVO:
-- 1. Criar um gatilho para bloquear o lançamento de notas após a data de trava.
-- 2. Criar uma RPC unificada para "fechar o período", que aciona as travas
--    para Frequências e Notas, e registra o evento em `audit_logs`.
-- 3. Descontinuar a função antiga (`refresh_frequencia_status_periodo`).
-- =================================================================

-- PASSO 1: Criar a função e o gatilho para bloquear o lançamento de notas

CREATE OR REPLACE FUNCTION public.block_notas_after_lock_date()
RETURNS TRIGGER AS $$
DECLARE
  v_trava_notas_em timestamptz;
BEGIN
  -- Encontra a data de trava a partir da avaliação associada à nota
  SELECT pl.trava_notas_em
  INTO v_trava_notas_em
  FROM public.avaliacoes a
  JOIN public.periodos_letivos pl ON a.periodo_letivo_id = pl.id
  WHERE a.id = NEW.avaliacao_id;

  -- Se a data de trava existe e já passou, rejeita a operação
  IF v_trava_notas_em IS NOT NULL AND v_trava_notas_em < now() THEN
    RAISE EXCEPTION 'O período para lançamento de notas está fechado (travado em %).', to_char(v_trava_notas_em, 'DD/MM/YYYY HH24:MI');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Anexa o gatilho à tabela de notas
DROP TRIGGER IF EXISTS trg_block_notas_after_lock_date ON public.notas;
CREATE TRIGGER trg_block_notas_after_lock_date
BEFORE INSERT OR UPDATE ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.block_notas_after_lock_date();


-- PASSO 2: Criar a nova RPC unificada `fechar_periodo_academico`

CREATE OR REPLACE FUNCTION public.fechar_periodo_academico(
  p_escola_id uuid,
  p_turma_id uuid,
  p_periodo_letivo_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  -- 1. Trava as Frequências (reutiliza a lógica existente)
  -- Primeiro, calcula e insere o resumo do período na tabela de status.
  INSERT INTO public.frequencia_status_periodo (
    escola_id, turma_id, periodo_letivo_id, aluno_id, matricula_id,
    aulas_previstas, presencas, faltas, atrasos, percentual_presenca,
    frequencia_min_percent, abaixo_minimo, updated_at
  )
  SELECT
    escola_id, turma_id, periodo_letivo_id, aluno_id, matricula_id,
    aulas_previstas, presencas, faltas, atrasos, percentual_presenca,
    frequencia_min_percent, abaixo_minimo, now()
  FROM public.frequencia_resumo_periodo(p_turma_id, p_periodo_letivo_id)
  ON CONFLICT (escola_id, turma_id, periodo_letivo_id, aluno_id)
  DO UPDATE SET
    aulas_previstas = EXCLUDED.aulas_previstas,
    presencas = EXCLUDED.presencas,
    faltas = EXCLUDED.faltas,
    atrasos = EXCLUDED.atrasos,
    percentual_presenca = EXCLUDED.percentual_presenca,
    frequencia_min_percent = EXCLUDED.frequencia_min_percent,
    abaixo_minimo = EXCLUDED.abaixo_minimo,
    updated_at = now();

  -- 2. Trava as Notas
  -- Define a data/hora da trava como "agora" no período letivo correspondente.
  UPDATE public.periodos_letivos
  SET trava_notas_em = now()
  WHERE id = p_periodo_letivo_id AND escola_id = p_escola_id;

  -- 3. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'FECHAMENTO_PERIODO',
    'periodos_letivos',
    p_periodo_letivo_id::text,
    'admin',
    jsonb_build_object(
      'turma_id', p_turma_id,
      'periodo_letivo_id', p_periodo_letivo_id,
      'action_comment', 'Período fechado para frequências e notas.'
    )
  );
END;
$$;

ALTER FUNCTION public.fechar_periodo_academico(uuid, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.fechar_periodo_academico(uuid, uuid, uuid) TO authenticated;

-- PASSO 3: (Opcional, mas recomendado) Descontinuar a função antiga para evitar uso acidental
-- Renomear é mais seguro do que remover.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'refresh_frequencia_status_periodo'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.refresh_frequencia_status_periodo(uuid, uuid) RENAME TO refresh_frequencia_status_periodo_deprecated';
  END IF;
END;
$$;


COMMIT;
