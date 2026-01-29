-- Migration: 20260127_fix_p0_issues.sql
-- Corrige status outbox e adiciona trigger faltante

BEGIN;



-- =========================================================
-- 2) CORRIGIR WORKER PARA USAR STATUS CORRETOS
-- =========================================================

CREATE OR REPLACE FUNCTION public.process_outbox_batch_p0(
  p_batch_size integer DEFAULT 20,
  p_max_retries integer DEFAULT 5
)
RETURNS TABLE (
  processed_count integer,
  failed_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_processed integer := 0;
  v_failed integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    WITH claimed AS (
      UPDATE public.outbox_events oe
      SET
        status = 'processing'::public.outbox_status,
        locked_at = v_now,
        locked_by = 'db_worker_' || pg_backend_pid()::text,
        attempts = oe.attempts + 1
      WHERE oe.id IN (
        SELECT oe2.id
        FROM public.outbox_events oe2
        WHERE oe2.status IN ('pending'::public.outbox_status, 'failed'::public.outbox_status)
          AND oe2.next_attempt_at <= v_now
          AND oe2.attempts < p_max_retries
        ORDER BY
          CASE oe2.event_type
            WHEN 'pagamento_registrado' THEN 1
            WHEN 'matricula_criada' THEN 2
            ELSE 3
          END,
          oe2.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
      )
      RETURNING oe.id, oe.escola_id, oe.event_type, oe.payload
    )
    SELECT * FROM claimed
  LOOP
    BEGIN
      -- Roteamento: chama update_* com jsonb "envelope"
      IF v_row.event_type = 'pagamento_registrado' THEN
        PERFORM public.update_financeiro_from_pagamento(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'nota_lancada' THEN
        PERFORM public.update_pedagogico_from_nota(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'presenca_lancada' THEN
        PERFORM public.update_secretaria_from_presenca(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      END IF;

      UPDATE public.outbox_events
      SET
        status = 'sent'::public.outbox_status,
        processed_at = v_now,
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL
      WHERE id = v_row.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.outbox_events
      SET
        status = CASE
          WHEN attempts >= p_max_retries THEN 'dead'::public.outbox_status
          ELSE 'failed'::public.outbox_status
        END,
        next_attempt_at = v_now + (INTERVAL '10 seconds' * power(2, GREATEST(attempts,1))),
        locked_at = NULL,
        locked_by = NULL,
        last_error = SQLERRM
      WHERE id = v_row.id;

      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed;
END;
$$;

-- =========================================================
-- 3) ADICIONAR TRIGGER DE MATRÍCULA (FALTANTE)
-- =========================================================

CREATE OR REPLACE FUNCTION public.trigger_matricula_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Apenas para matrículas ativas/pendentes
  IF NEW.status IN ('ativa', 'ativo', 'pendente') THEN
    INSERT INTO public.outbox_events (
      escola_id,
      event_type,
      dedupe_key,
      idempotency_key,
      payload,
      tenant_scope
    )
    VALUES (
      NEW.escola_id,
      'matricula_criada',
      'matricula:' || NEW.id::text,
      'matricula:' || NEW.id::text,
      jsonb_build_object(
        'matricula_id', NEW.id,
        'aluno_id', NEW.aluno_id,
        'turma_id', NEW.turma_id,
        'status', NEW.status
      ),
      'escola:' || NEW.escola_id::text
    )
    ON CONFLICT (escola_id, dedupe_key) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matriculas_outbox_insert ON public.matriculas;
CREATE TRIGGER matriculas_outbox_insert
AFTER INSERT ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_matricula_outbox();

-- =========================================================
-- 4) ADICIONAR FUNÇÃO PARA PROCESSAR MATRÍCULA NO WORKER
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_secretaria_from_matricula(p_event jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid := (p_event->>'escola_id')::uuid;
  v_turma_id uuid := (p_event->'payload'->>'turma_id')::uuid;
  v_data_ref date := date_trunc('month', now())::date;
BEGIN
  PERFORM public.recalc_secretaria_turma_counts(v_escola_id, v_turma_id, v_data_ref);
END;
$$;

-- Atualizar worker para incluir matrícula
CREATE OR REPLACE FUNCTION public.process_outbox_batch_p0_v2(
  p_batch_size integer DEFAULT 20,
  p_max_retries integer DEFAULT 5
)
RETURNS TABLE (
  processed_count integer,
  failed_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_processed integer := 0;
  v_failed integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    WITH claimed AS (
      UPDATE public.outbox_events oe
      SET
        status = 'processing'::public.outbox_status,
        locked_at = v_now,
        locked_by = 'db_worker_' || pg_backend_pid()::text,
        attempts = oe.attempts + 1
      WHERE oe.id IN (
        SELECT oe2.id
        FROM public.outbox_events oe2
        WHERE oe2.status IN ('pending'::public.outbox_status, 'failed'::public.outbox_status)
          AND oe2.next_attempt_at <= v_now
          AND oe2.attempts < p_max_retries
        ORDER BY
          CASE oe2.event_type
            WHEN 'pagamento_registrado' THEN 1
            WHEN 'matricula_criada' THEN 2
            ELSE 3
          END,
          oe2.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
      )
      RETURNING oe.id, oe.escola_id, oe.event_type, oe.payload
    )
    SELECT * FROM claimed
  LOOP
    BEGIN
      -- Roteamento
      IF v_row.event_type = 'pagamento_registrado' THEN
        PERFORM public.update_financeiro_from_pagamento(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'nota_lancada' THEN
        PERFORM public.update_pedagogico_from_nota(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'presenca_lancada' THEN
        PERFORM public.update_secretaria_from_presenca(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'matricula_criada' THEN
        PERFORM public.update_secretaria_from_matricula(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      END IF;

      UPDATE public.outbox_events
      SET
        status = 'sent'::public.outbox_status,
        processed_at = v_now,
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL
      WHERE id = v_row.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.outbox_events
      SET
        status = CASE
          WHEN attempts >= p_max_retries THEN 'dead'::public.outbox_status
          ELSE 'failed'::public.outbox_status
        END,
        next_attempt_at = v_now + (INTERVAL '10 seconds' * power(2, GREATEST(attempts,1))),
        locked_at = NULL,
        locked_by = NULL,
        last_error = SQLERRM
      WHERE id = v_row.id;

      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed;
END;
$$;

-- =========================================================
-- 5) CRIAR ÍNDICE FALTANTE PARA PERFORMANCE
-- =========================================================

-- Índice crítico para recalc_escola_financeiro_totals (REMOVIDO TEMPORARIAMENTE: date_trunc não é IMMUTABLE)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financeiro_lancamentos_escola_vencimento
--   ON public.financeiro_lancamentos (escola_id, date_trunc('month', data_vencimento), tipo, status);

-- Índice para mensalidades (REMOVIDO TEMPORARIAMENTE: date_trunc não é IMMUTABLE)
-- CREATE INDEX IF NOT EXISTS idx_mensalidades_escola_vencimento_status
--   ON public.mensalidades (escola_id, date_trunc('month', data_vencimento), status)
--   WHERE status IN ('pendente', 'pago');

-- =========================================================
-- 6) ADICIONAR VIEW DO BALCÃO (FALTANTE)
-- =========================================================

CREATE OR REPLACE VIEW public.vw_balcao_secretaria AS
SELECT 
  a.id as aluno_id,
  a.nome as aluno_nome,
  a.encarregado_telefone,
  m.turma_id,
  t.nome as turma_nome,
  COALESCE(af.total_pendente, 0) as total_pendente,
  COALESCE(af.total_inadimplente, 0) > 0 as esta_inadimplente,
  COALESCE(af.sync_status, 'synced') as sync_status,
  a.escola_id
FROM public.alunos a
JOIN public.matriculas m ON m.aluno_id = a.id 
  AND m.status IN ('ativa', 'ativo')
JOIN public.turmas t ON t.id = m.turma_id
LEFT JOIN public.aggregates_financeiro af ON af.aluno_id = a.id 
  AND af.data_referencia = date_trunc('month', now())::date
  AND af.escola_id = a.escola_id
WHERE a.status = 'ativo'
  AND a.deleted_at IS NULL;


DROP FUNCTION IF EXISTS public.process_outbox_batch_p0(integer, integer);

COMMIT;
