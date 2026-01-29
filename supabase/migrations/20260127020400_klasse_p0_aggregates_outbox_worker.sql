-- Migration: 20260126_klasse_p0_aggregates_outbox_worker.sql
-- KLASSE P0: Aggregates + Outbox triggers + Worker + Views
-- Compatível com schema do dia 26/01/2026

BEGIN;

-- =========================================================
-- 0) PRE-REQS / GUARDA-CHUVAS
-- =========================================================
-- A outbox_events JÁ existe no teu schema. Aqui só ajustamos índices/uniques
-- e adicionamos triggers e worker.

-- =========================================================
-- 1) AGGREGATES (TABELAS FÍSICAS) - P0
-- =========================================================

CREATE TABLE IF NOT EXISTS public.aggregates_financeiro (
  escola_id uuid NOT NULL,
  data_referencia date NOT NULL,
  aluno_id uuid, -- NULL = agregado geral da escola no mês

  total_pendente numeric(12,2) NOT NULL DEFAULT 0,
  total_pago numeric(12,2) NOT NULL DEFAULT 0,
  total_inadimplente numeric(12,2) NOT NULL DEFAULT 0,
  alunos_inadimplentes integer NOT NULL DEFAULT 0,
  alunos_em_dia integer NOT NULL DEFAULT 0,

  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced','pending','error','retry')),
  sync_updated_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (escola_id, data_referencia, aluno_id),
  CONSTRAINT aggregates_financeiro_escola_fk
    FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aggregates_financeiro_escola_data
  ON public.aggregates_financeiro (escola_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_aggregates_financeiro_sync
  ON public.aggregates_financeiro (escola_id, sync_status)
  WHERE sync_status IN ('pending','error','retry');


CREATE TABLE IF NOT EXISTS public.aggregates_pedagogico (
  escola_id uuid NOT NULL,
  periodo_letivo_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  disciplina_id uuid NOT NULL,

  media_geral numeric(6,2),
  maior_nota numeric(6,2),
  menor_nota numeric(6,2),
  total_lancamentos integer NOT NULL DEFAULT 0,

  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced','pending','error','retry')),
  sync_updated_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (escola_id, periodo_letivo_id, turma_id, disciplina_id),
  CONSTRAINT aggregates_pedagogico_escola_fk
    FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aggregates_pedagogico_keys
  ON public.aggregates_pedagogico (escola_id, periodo_letivo_id, turma_id, disciplina_id);


CREATE TABLE IF NOT EXISTS public.aggregates_secretaria (
  escola_id uuid NOT NULL,
  data_referencia date NOT NULL,
  turma_id uuid NOT NULL,

  total_alunos integer NOT NULL DEFAULT 0,
  alunos_ativos integer NOT NULL DEFAULT 0,
  alunos_inativos integer NOT NULL DEFAULT 0,

  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced','pending','error','retry')),
  sync_updated_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (escola_id, data_referencia, turma_id),
  CONSTRAINT aggregates_secretaria_escola_fk
    FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aggregates_secretaria_escola_data
  ON public.aggregates_secretaria (escola_id, data_referencia DESC);

-- =========================================================
-- 2) RLS NAS AGGREGATES (READ-ONLY no app; write via service_role)
-- =========================================================

ALTER TABLE public.aggregates_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregates_pedagogico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregates_secretaria ENABLE ROW LEVEL SECURITY;

-- Read isolado por escola_id (usa tua função current_tenant_escola_id())
DROP POLICY IF EXISTS aggregates_financeiro_select ON public.aggregates_financeiro;
CREATE POLICY aggregates_financeiro_select
  ON public.aggregates_financeiro
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS aggregates_pedagogico_select ON public.aggregates_pedagogico;
CREATE POLICY aggregates_pedagogico_select
  ON public.aggregates_pedagogico
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS aggregates_secretaria_select ON public.aggregates_secretaria;
CREATE POLICY aggregates_secretaria_select
  ON public.aggregates_secretaria
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

-- NÃO criamos policies de INSERT/UPDATE/DELETE: client não mexe em aggregates.
-- Worker roda com service_role e bypassa RLS.

-- =========================================================
-- 3) OUTBOX: ÍNDICES/UNIQUES NECESSÁRIOS (na tua tabela existente)
-- =========================================================

-- Idempotência por escola + dedupe_key
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_escola_dedupe
  ON public.outbox_events (escola_id, dedupe_key);

-- Para worker buscar backlog rápido
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON public.outbox_events (status, next_attempt_at, escola_id)
  WHERE status IN ('pending'::public.outbox_status,'failed'::public.outbox_status);

CREATE INDEX IF NOT EXISTS idx_outbox_escola_created
  ON public.outbox_events (escola_id, created_at DESC);

-- =========================================================
-- 4) TRIGGERS (INSERT-ONLY) -> OUTBOX
-- =========================================================




-- 4.2 Notas -> outbox (schema ok: notas tem escola_id, avaliacao_id, matricula_id, valor)
CREATE OR REPLACE FUNCTION public.trigger_nota_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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
    'nota_lancada',
    'nota:' || NEW.avaliacao_id::text || ':' || NEW.matricula_id::text,
    'nota:' || NEW.avaliacao_id::text || ':' || NEW.matricula_id::text,
    jsonb_build_object(
      'nota_id', NEW.id,
      'avaliacao_id', NEW.avaliacao_id,
      'matricula_id', NEW.matricula_id,
      'valor', NEW.valor
    ),
    'escola:' || NEW.escola_id::text
  )
  ON CONFLICT (escola_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notas_outbox_insert ON public.notas;
CREATE TRIGGER notas_outbox_insert
AFTER INSERT ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_nota_outbox();


-- 4.3 Frequencias (presença) -> outbox (schema ok em frequencias_default)
CREATE OR REPLACE FUNCTION public.trigger_presenca_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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
    'presenca_lancada',
    'presenca:' || NEW.matricula_id::text || ':' || NEW.data::text,
    'presenca:' || NEW.matricula_id::text || ':' || NEW.data::text,
    jsonb_build_object(
      'frequencia_id', NEW.id,
      'matricula_id', NEW.matricula_id,
      'data', NEW.data,
      'status', NEW.status
    ),
    'escola:' || NEW.escola_id::text
  )
  ON CONFLICT (escola_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS frequencias_outbox_insert ON public.frequencias_default;
CREATE TRIGGER frequencias_outbox_insert
AFTER INSERT ON public.frequencias_default
FOR EACH ROW
EXECUTE FUNCTION public.trigger_presenca_outbox();


-- 4.4 Financeiro Lancamentos -> outbox (append-only)
CREATE OR REPLACE FUNCTION public.trigger_financeiro_lancamento_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Gate condition: only fire for paid, credit transactions
  IF NEW.tipo = 'credito' AND NEW.status = 'pago' AND NEW.data_pagamento IS NOT NULL AND NEW.valor_total > 0 THEN
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
      'pagamento_registrado',
      'financeiro_lancamento:' || NEW.id::text,
      'financeiro_lancamento:' || NEW.id::text,
      jsonb_build_object(
        'lancamento_id', NEW.id,
        'aluno_id', NEW.aluno_id,
        'valor_total', NEW.valor_total,
        'data_pagamento', NEW.data_pagamento
      ),
      'escola:' || NEW.escola_id::text
    )
    ON CONFLICT (escola_id, dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financeiro_lancamentos_outbox_insert ON public.financeiro_lancamentos;
CREATE TRIGGER financeiro_lancamentos_outbox_insert
AFTER INSERT ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_financeiro_lancamento_outbox();

-- 4.5 Block updates to paid lancamentos
CREATE OR REPLACE FUNCTION public.block_paid_lancamento_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates only if the status is not 'pago'
  IF OLD.status = 'pago' THEN
    RAISE EXCEPTION 'Não é permitido editar um lançamento financeiro que já foi pago.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_paid_updates ON public.financeiro_lancamentos;
CREATE TRIGGER block_paid_updates
BEFORE UPDATE ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.block_paid_lancamento_update();


-- =========================================================
-- 5) FUNÇÕES DE UPDATE DOS AGGREGATES (P0: corretas e simples)
-- =========================================================

-- 5.1 Financeiro: recalcular agregado geral (aluno_id NULL) baseado em mensalidades
CREATE OR REPLACE FUNCTION public.recalc_escola_financeiro_totals(
  p_escola_id uuid,
  p_data_referencia date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_pendente numeric(12,2);
  v_pago numeric(12,2);
  v_inadimplentes integer;
  v_em_dia integer;
  v_inadimplente_valor numeric(12,2);
BEGIN
  -- Lógica baseada em financeiro_lancamentos
  SELECT
    -- Total pendente: soma de débitos pendentes no mês
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'debito' AND l.status = 'pendente'), 0),
    -- Total pago: soma de créditos pagos no mês
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'credito' AND l.status = 'pago'), 0),
    -- Alunos inadimplentes: contagem distinta de alunos com débitos vencidos no mês
    COUNT(DISTINCT CASE WHEN l.tipo = 'debito' AND l.status = 'pendente' AND l.data_vencimento < CURRENT_DATE THEN l.aluno_id END),
    -- Alunos em dia: contagem distinta de alunos que realizaram um pagamento (crédito) no mês
    COUNT(DISTINCT CASE WHEN l.tipo = 'credito' AND l.status = 'pago' THEN l.aluno_id END),
    -- Valor inadimplente: soma de débitos vencidos no mês
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'debito' AND l.status = 'pendente' AND l.data_vencimento < CURRENT_DATE), 0)
  INTO v_pendente, v_pago, v_inadimplentes, v_em_dia, v_inadimplente_valor
  FROM public.financeiro_lancamentos l
  WHERE l.escola_id = p_escola_id
    AND date_trunc('month', l.data_vencimento)::date = date_trunc('month', p_data_referencia)::date;

  INSERT INTO public.aggregates_financeiro (
    escola_id, data_referencia, aluno_id,
    total_pendente, total_pago, total_inadimplente,
    alunos_inadimplentes, alunos_em_dia,
    sync_status, sync_updated_at, updated_at
  )
  VALUES (
    p_escola_id, date_trunc('month', p_data_referencia)::date, NULL,
    v_pendente, v_pago, v_inadimplente_valor,
    v_inadimplentes, v_em_dia,
    'synced', now(), now()
  )
  ON CONFLICT (escola_id, data_referencia, aluno_id)
  DO UPDATE SET
    total_pendente = EXCLUDED.total_pendente,
    total_pago = EXCLUDED.total_pago,
    total_inadimplente = EXCLUDED.total_inadimplente,
    alunos_inadimplentes = EXCLUDED.alunos_inadimplentes,
    alunos_em_dia = EXCLUDED.alunos_em_dia,
    sync_status = 'synced',
    sync_updated_at = now(),
    updated_at = now();
END;
$$;


-- 5.2 Financeiro: processar pagamento -> atualizar aluno + recalcular escola
CREATE OR REPLACE FUNCTION public.update_financeiro_from_pagamento(p_event jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid := (p_event->>'escola_id')::uuid;
  v_data_pagamento date := (p_event->'payload'->>'data_pagamento')::date;
BEGIN
  -- The trigger only fires for paid credits, so we just need to trigger a recalc
  -- for the relevant month.
  IF v_escola_id IS NOT NULL AND v_data_pagamento IS NOT NULL THEN
    PERFORM public.recalc_escola_financeiro_totals(v_escola_id, v_data_pagamento);
  END IF;
END;
$$;


-- 5.3 Pedagógico: recalcular métricas da combinação (periodo, turma, disciplina) após nota
-- P0: recalcula via JOIN avaliacoes -> turma_disciplinas -> curso_matriz
CREATE OR REPLACE FUNCTION public.update_pedagogico_from_nota(p_event jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid := (p_event->>'escola_id')::uuid;
  v_avaliacao_id uuid := (p_event->'payload'->>'avaliacao_id')::uuid;

  v_periodo_letivo_id uuid;
  v_turma_id uuid;
  v_disciplina_id uuid;

BEGIN
  SELECT
    a.periodo_letivo_id,
    td.turma_id,
    cm.disciplina_id
  INTO v_periodo_letivo_id, v_turma_id, v_disciplina_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  WHERE a.id = v_avaliacao_id
    AND a.escola_id = v_escola_id
  LIMIT 1;

  IF v_periodo_letivo_id IS NULL OR v_turma_id IS NULL OR v_disciplina_id IS NULL THEN
    RETURN;
  END IF;

  -- Recalcula métricas a partir das notas da mesma turma/disciplina/periodo
  WITH base AS (
    SELECT n.valor
    FROM public.notas n
    JOIN public.avaliacoes a2 ON a2.id = n.avaliacao_id
    JOIN public.turma_disciplinas td2 ON td2.id = a2.turma_disciplina_id
    JOIN public.curso_matriz cm2 ON cm2.id = td2.curso_matriz_id
    WHERE n.escola_id = v_escola_id
      AND a2.periodo_letivo_id = v_periodo_letivo_id
      AND td2.turma_id = v_turma_id
      AND cm2.disciplina_id = v_disciplina_id
  )
  INSERT INTO public.aggregates_pedagogico (
    escola_id, periodo_letivo_id, turma_id, disciplina_id,
    media_geral, maior_nota, menor_nota, total_lancamentos,
    sync_status, sync_updated_at, updated_at
  )
  SELECT
    v_escola_id, v_periodo_letivo_id, v_turma_id, v_disciplina_id,
    ROUND(AVG(valor)::numeric, 2),
    MAX(valor),
    MIN(valor),
    COUNT(*),
    'synced', now(), now()
  FROM base
  ON CONFLICT (escola_id, periodo_letivo_id, turma_id, disciplina_id)
  DO UPDATE SET
    media_geral = EXCLUDED.media_geral,
    maior_nota = EXCLUDED.maior_nota,
    menor_nota = EXCLUDED.menor_nota,
    total_lancamentos = EXCLUDED.total_lancamentos,
    sync_status = 'synced',
    sync_updated_at = now(),
    updated_at = now();
END;
$$;


-- 5.4 Secretaria: recalcular contagem de alunos por turma (mês corrente) após presença
-- P0: rápido e robusto (não tenta “frequência %” ainda)
CREATE OR REPLACE FUNCTION public.recalc_secretaria_turma_counts(
  p_escola_id uuid,
  p_turma_id uuid,
  p_data_referencia date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer;
  v_ativos integer;
  v_inativos integer;
BEGIN
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE m.status IN ('ativa','ativo'))::int,
    COUNT(*) FILTER (WHERE m.status IN ('inativo'))::int
  INTO v_total, v_ativos, v_inativos
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = p_turma_id;

  INSERT INTO public.aggregates_secretaria (
    escola_id, data_referencia, turma_id,
    total_alunos, alunos_ativos, alunos_inativos,
    sync_status, sync_updated_at, updated_at
  )
  VALUES (
    p_escola_id, date_trunc('month', p_data_referencia)::date, p_turma_id,
    COALESCE(v_total,0), COALESCE(v_ativos,0), COALESCE(v_inativos,0),
    'synced', now(), now()
  )
  ON CONFLICT (escola_id, data_referencia, turma_id)
  DO UPDATE SET
    total_alunos = EXCLUDED.total_alunos,
    alunos_ativos = EXCLUDED.alunos_ativos,
    alunos_inativos = EXCLUDED.alunos_inativos,
    sync_status = 'synced',
    sync_updated_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_secretaria_from_presenca(p_event jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid := (p_event->>'escola_id')::uuid;
  v_matricula_id uuid := (p_event->'payload'->>'matricula_id')::uuid;
  v_data date := (p_event->'payload'->>'data')::date;
  v_turma_id uuid;
BEGIN
  SELECT m.turma_id INTO v_turma_id
  FROM public.matriculas m
  WHERE m.id = v_matricula_id;

  IF v_turma_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.recalc_secretaria_turma_counts(v_escola_id, v_turma_id, v_data);
END;
$$;


-- =========================================================
-- 6) WORKER P0: CLAIM + PROCESS (SEM RACE)
-- =========================================================
-- Importante: aqui a gente NÃO depende do tipo outbox_status “no nome”.
-- Usamos ::text nas comparações e setamos valores por texto.

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
        status = 'processing'::text::public.outbox_status,
        locked_at = v_now,
        locked_by = 'db_worker_' || pg_backend_pid()::text,
        attempts = oe.attempts + 1
      WHERE oe.id IN (
        SELECT oe2.id
        FROM public.outbox_events oe2
        WHERE oe2.status::text IN ('pending','failed')
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
      -- Roteamento: chama update_* com jsonb “envelope”
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
        -- (P0) Se quiser, depois adicionamos aggregate de frequência real.

      END IF;

      UPDATE public.outbox_events
      SET
        status = 'sent'::text::public.outbox_status,
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
          WHEN attempts >= p_max_retries THEN 'dead'::text::public.outbox_status
          ELSE 'failed'::text::public.outbox_status
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
-- 7) VIEWS P0 (LEITURA RÁPIDA, SEM SUM DUPLO)
-- =========================================================

CREATE OR REPLACE VIEW public.vw_financeiro_dashboard AS
SELECT
  af.escola_id,
  af.data_referencia,
  af.total_pendente,
  af.total_pago,
  af.total_inadimplente,
  af.alunos_inadimplentes,
  af.alunos_em_dia,
  af.sync_status,
  af.sync_updated_at
FROM public.aggregates_financeiro af
WHERE af.aluno_id IS NULL
  AND af.data_referencia = date_trunc('month', now())::date;

COMMIT;
