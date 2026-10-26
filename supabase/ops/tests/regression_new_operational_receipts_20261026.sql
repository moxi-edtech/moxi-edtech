-- Run only in a disposable PostgreSQL 17 database, never production.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.outbox_status AS ENUM ('pending','processing','sent','failed','dead');
CREATE TABLE public.escolas(id uuid PRIMARY KEY);
CREATE TABLE public.alunos(id uuid PRIMARY KEY, escola_id uuid NOT NULL, nome text NOT NULL, bi_numero text);
CREATE TABLE public.mensalidades (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  status text NOT NULL, valor_pago_total numeric NOT NULL DEFAULT 0,
  ano_referencia integer NOT NULL, mes_referencia smallint NOT NULL,
  data_pagamento_efetiva date, metodo_pagamento text
);
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid,
  mensalidade_id uuid, status text NOT NULL, valor_pago numeric NOT NULL,
  data_pagamento date, metodo text NOT NULL DEFAULT 'cash', reference text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL, event_type text NOT NULL, dedupe_key text NOT NULL,
  idempotency_key text NOT NULL, tenant_scope text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, last_error text, locked_at timestamptz, locked_by text
);
CREATE TABLE public.documentos_sequencia(
  escola_id uuid PRIMARY KEY, ultimo_numero integer NOT NULL, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL, aluno_id uuid NOT NULL, mensalidade_id uuid,
  numero_sequencial integer, tipo text NOT NULL,
  idempotency_key text, idempotency_fingerprint text,
  dados_snapshot jsonb NOT NULL, created_by uuid, hash_validacao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos_emitidos ADD CONSTRAINT documentos_emitidos_idempotency_pair_chk
  CHECK ((idempotency_key IS NULL AND idempotency_fingerprint IS NULL) OR
         (idempotency_key IS NOT NULL AND idempotency_fingerprint IS NOT NULL
          AND length(btrim(idempotency_key)) BETWEEN 8 AND 200
          AND length(btrim(idempotency_fingerprint)) BETWEEN 16 AND 128));
CREATE UNIQUE INDEX uq_documentos_recibo_por_mensalidade
  ON public.documentos_emitidos(mensalidade_id) WHERE tipo='recibo' AND mensalidade_id IS NOT NULL;
CREATE UNIQUE INDEX ux_documentos_emitidos_escola_idempotency
  ON public.documentos_emitidos(escola_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX ux_documentos_emitidos_escola_numero
  ON public.documentos_emitidos(escola_id,numero_sequencial) WHERE numero_sequencial IS NOT NULL;
CREATE TABLE public.turmas (id uuid PRIMARY KEY, nome text, turno text, classe_id uuid, curso_id uuid);
CREATE TABLE public.classes (id uuid PRIMARY KEY, nome text);
CREATE TABLE public.cursos (id uuid PRIMARY KEY, nome text);
CREATE TABLE public.historico_anos (aluno_id uuid, turma_id uuid, ano_letivo integer);
CREATE OR REPLACE FUNCTION public.next_documento_numero(p_escola_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.documentos_sequencia(escola_id,ultimo_numero) VALUES(p_escola_id,1)
  ON CONFLICT(escola_id) DO UPDATE SET ultimo_numero=documentos_sequencia.ultimo_numero+1
  RETURNING ultimo_numero INTO n;
  RETURN n;
END $$;

-- PostgreSQL CI image has no pg_cron; assert schedule registration with a stub.
CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, jobname text, schedule text, command text);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  INSERT INTO cron.job(jobname,schedule,command) VALUES ($1,$2,$3)
  RETURNING jobid INTO n;
  RETURN n;
END $$;

-- Import the REAL operational monthly issuer, not a fake RPC implementation.
\ir ../../migrations/20260604124000_automatic_receipts_backend.sql
\ir ../../migrations/20271026123000_operational_receipt_outbox_worker.sql

INSERT INTO public.escolas(id)
VALUES ('00000000-0000-4000-8000-000000000101'),
       ('00000000-0000-4000-8000-000000000102');
INSERT INTO public.alunos(id,escola_id,nome,bi_numero)
VALUES('00000000-0000-4000-8000-000000000201',
       '00000000-0000-4000-8000-000000000101','Aluno Sintético','TESTONLY');
INSERT INTO public.mensalidades(id,escola_id,aluno_id,status,valor_pago_total,
 ano_referencia,mes_referencia,data_pagamento_efetiva,metodo_pagamento)
VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','pago',5000,2026,10,now()::date,'cash'),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','pendente',5000,2026,11,NULL,'cash'),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','pago',5000,2026,12,now()::date,'cash');
INSERT INTO public.pagamentos(id,escola_id,aluno_id,mensalidade_id,status,valor_pago,data_pagamento,meta)
VALUES
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301','settled',5000,now()::date,'{"emitir_recibo":true,"itens":[{"tipo":"servico","nome":"Certidão","preco":800},{"tipo":"mensalidade","nome":"Mensalidade outubro","preco":5000}]}'),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'settled',800,now()::date,'{"emitir_recibo":true,"itens":[{"tipo":"servico","nome":"Emissão de documentos","preco":800}]}'),
('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'settled',800,now()::date,'{"emitir_recibo":false}'),
('00000000-0000-4000-8000-000000000404','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'voided',800,now()::date,'{"emitir_recibo":true}'),
('00000000-0000-4000-8000-000000000405','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'settled',800,now()::date,'{"emitir_recibo":true}'),
('00000000-0000-4000-8000-000000000406','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000302','settled',5000,now()::date,'{"emitir_recibo":true}'),
('00000000-0000-4000-8000-000000000407','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'pending',700,now()::date,'{"emitir_recibo":true}'),
('00000000-0000-4000-8000-000000000408','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301','settled',5000,now()::date,'{"emitir_recibo":false}'),
('00000000-0000-4000-8000-000000000409','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201',NULL,'settled',900,now()::date,'{"emitir_recibo":true,"itens":[{"tipo":"mensalidade","nome":"Mensalidade dezembro","preco":5000},{"tipo":"servico","nome":"Declaração","preco":900}]}'),
('00000000-0000-4000-8000-000000000410','00000000-0000-4000-8000-000000000101',
 '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000303','settled',5000,now()::date,'{"emitir_recibo":false}');

-- Every row is new EXCEPT 499: it is the historical backlog, NOT a replay.
INSERT INTO public.outbox_events(escola_id,event_type,dedupe_key,idempotency_key,payload,created_at)
SELECT CASE WHEN x.n=5 THEN '00000000-0000-4000-8000-000000000102'::uuid
            ELSE '00000000-0000-4000-8000-000000000101'::uuid END,
 'financeiro_recibo_pagamento', 'test-'||x.n,'test-'||x.n,
 jsonb_build_object('pagamento_id',CASE WHEN x.n=11 THEN '00000000-0000-4000-8000-000000000405'
  WHEN x.n=1 OR x.n=9 THEN '00000000-0000-4000-8000-000000000401'
  WHEN x.n=2 OR x.n=10 THEN '00000000-0000-4000-8000-000000000402'
  WHEN x.n=3 THEN '00000000-0000-4000-8000-000000000403'
  WHEN x.n=4 THEN '00000000-0000-4000-8000-000000000404'
  WHEN x.n=5 THEN '00000000-0000-4000-8000-000000000405'
  WHEN x.n=6 THEN '00000000-0000-4000-8000-000000000406'
  WHEN x.n=7 THEN '00000000-0000-4000-8000-000000000407'
  WHEN x.n=8 THEN '00000000-0000-4000-8000-000000000408'
  WHEN x.n=12 THEN '00000000-0000-4000-8000-000000000409'
  WHEN x.n=13 THEN '00000000-0000-4000-8000-000000000410' END,
 'mensalidade_id',CASE WHEN x.n IN(1,9,8) THEN '00000000-0000-4000-8000-000000000301'
  WHEN x.n=13 THEN '00000000-0000-4000-8000-000000000303'
  WHEN x.n=6 THEN '00000000-0000-4000-8000-000000000302'
  ELSE NULL END),
 (SELECT started_at + CASE WHEN x.n=11 THEN interval '-1 second' ELSE interval '1 second' END
    FROM public.operational_receipt_worker_control)
FROM generate_series(1,13) x(n);

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.process_operational_receipt_outbox(25);
  IF r.issued_count <> 5 OR r.skipped_count <> 4 OR r.failed_count <> 3 THEN
    RAISE EXCEPTION 'incorrect first batch counts issued %, skipped %, failed %',
      r.issued_count,r.skipped_count,r.failed_count;
  END IF;
  IF (SELECT count(*) FROM public.documentos_emitidos WHERE tipo='recibo') <> 3 THEN
    RAISE EXCEPTION 'three receipts (monthly and services) must be emitted exactly once';
  END IF;
  IF (SELECT count(*) FROM public.documentos_emitidos WHERE mensalidade_id =
      '00000000-0000-4000-8000-000000000301') <> 1 THEN
    RAISE EXCEPTION 'monthly receipt not generated or duplicated';
  END IF;
  IF (SELECT count(*) FROM public.documentos_emitidos WHERE dados_snapshot->>'pagamento_id' =
      '00000000-0000-4000-8000-000000000402') <> 1 THEN
    RAISE EXCEPTION 'service receipt not generated or duplicated';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.documentos_emitidos
    WHERE mensalidade_id='00000000-0000-4000-8000-000000000301'
      AND jsonb_array_length(dados_snapshot->'itens_pagamento') = 2
      AND (dados_snapshot->>'valor_pago')::numeric = 5800
      AND dados_snapshot->'itens_pagamento'->0->>'descricao' = 'Certidão'
  ) THEN
    RAISE EXCEPTION 'consolidated monthly receipt did not preserve all payment lines';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.documentos_emitidos
    WHERE dados_snapshot->>'pagamento_id'='00000000-0000-4000-8000-000000000402'
      AND dados_snapshot->'itens_pagamento'->0->>'descricao' = 'Emissão de documentos'
      AND (dados_snapshot->'itens_pagamento'->0->>'valor')::numeric=800
  ) THEN
    RAISE EXCEPTION 'service receipt line items not normalized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.documentos_emitidos
    WHERE dados_snapshot->>'pagamento_id'='00000000-0000-4000-8000-000000000409'
      AND jsonb_array_length(dados_snapshot->'itens_pagamento') = 2
      AND (dados_snapshot->>'valor_pago')::numeric = 5900
      AND dados_snapshot->'itens_pagamento'->1->>'descricao' = 'Declaração'
  ) THEN
    RAISE EXCEPTION 'service-final consolidated receipt has incorrect total or lines';
  END IF;
  IF EXISTS(SELECT 1 FROM public.documentos_emitidos WHERE
     idempotency_key LIKE 'pagamento_recibo:%' AND (idempotency_fingerprint IS NULL
       OR length(idempotency_fingerprint) <> 64 OR numero_sequencial IS NULL)) THEN
    RAISE EXCEPTION 'missing fiscal-safe operational metadata';
  END IF;
  IF EXISTS(SELECT 1 FROM public.outbox_events WHERE dedupe_key='test-11'
    AND (status <> 'pending' OR attempts <> 0)) THEN
    RAISE EXCEPTION 'historical event was replayed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.outbox_events WHERE dedupe_key='test-4'
    AND (status <> 'dead' OR last_error <> 'RECEIPT_PAYMENT_VOIDED')) THEN
    RAISE EXCEPTION 'voided payment was not rejected';
  END IF;
  IF EXISTS(SELECT 1 FROM public.outbox_events WHERE dedupe_key IN ('test-5','test-6','test-7')
    AND status <> 'failed') THEN
    RAISE EXCEPTION 'invalid payment/tenant was emitted';
  END IF;
  SELECT * INTO r FROM public.process_operational_receipt_outbox(25);
  IF r.issued_count <> 0 OR r.skipped_count <> 0 OR r.failed_count <> 0 THEN
    RAISE EXCEPTION 'idempotent no-work run failed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.outbox_events WHERE status='processing') THEN
    RAISE EXCEPTION 'processing lock leaked';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname='operational-receipts-1m'
      AND schedule='* * * * *') <> 1 THEN
    RAISE EXCEPTION 'one-minute cron not registered';
  END IF;
  IF has_function_privilege('authenticated',
     'public.process_operational_receipt_outbox(integer)','EXECUTE')
     OR has_function_privilege('service_role',
     'public.process_operational_receipt_outbox(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'private cron function callable over public RPC';
  END IF;
END $$;
