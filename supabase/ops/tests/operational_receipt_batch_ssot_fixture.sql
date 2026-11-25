-- Minimal PostgreSQL 17 isolated fixture. No production data or credentials.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000099'::uuid $$;
CREATE TYPE public.tipo_documento AS ENUM ('recibo');
CREATE TYPE public.outbox_status AS ENUM ('pending','failed','processing','sent','dead');
CREATE TABLE public.alunos(id uuid PRIMARY KEY, escola_id uuid NOT NULL,nome text,bi_numero text);
CREATE TABLE public.profiles(user_id uuid,escola_id uuid,current_escola_id uuid);
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY, escola_id uuid,ano integer,ativo boolean,data_inicio date);
CREATE TABLE public.classes(id uuid PRIMARY KEY,escola_id uuid,nome text);
CREATE TABLE public.cursos(id uuid PRIMARY KEY,escola_id uuid,nome text);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,ano_letivo integer,nome text,turno text,classe_id uuid,curso_id uuid);
CREATE TABLE public.matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,ano_letivo integer,turma_id uuid,status text,created_at timestamptz DEFAULT now());
CREATE TABLE public.mensalidades(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,matricula_id uuid,turma_id uuid,ano_letivo integer,
  ano_referencia integer,mes_referencia integer,status text,valor_pago_total numeric,data_pagamento_efetiva date,metodo_pagamento text);
CREATE TABLE public.matricula_reclassificacoes(escola_id uuid,aluno_id uuid,status text);
CREATE TABLE public.pagamentos(id uuid PRIMARY KEY,escola_id uuid NOT NULL,aluno_id uuid,mensalidade_id uuid,
  status text NOT NULL,valor_pago numeric NOT NULL,meta jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  data_pagamento date DEFAULT current_date,metodo text DEFAULT 'cash',metodo_pagamento text,reference text);
CREATE TABLE public.documentos_emitidos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,aluno_id uuid NOT NULL,mensalidade_id uuid,numero_sequencial integer,tipo public.tipo_documento NOT NULL,
  idempotency_key text,idempotency_fingerprint text,dados_snapshot jsonb NOT NULL,created_at timestamptz DEFAULT now(),
  created_by uuid,hash_validacao text NOT NULL,revoked_at timestamptz);
CREATE UNIQUE INDEX ON public.documentos_emitidos(escola_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX ON public.documentos_emitidos(mensalidade_id) WHERE tipo='recibo' AND mensalidade_id IS NOT NULL;
CREATE UNIQUE INDEX ON public.documentos_emitidos(escola_id,numero_sequencial) WHERE numero_sequencial IS NOT NULL;
CREATE SEQUENCE public.test_document_numbers;
CREATE FUNCTION public.next_documento_numero(uuid) RETURNS bigint LANGUAGE sql AS $$ SELECT nextval('public.test_document_numbers') $$;
CREATE TABLE public.operational_receipt_worker_control(singleton boolean,started_at timestamptz,enabled boolean);
CREATE TABLE public.outbox_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,event_type text,dedupe_key text UNIQUE,
  idempotency_key text,payload jsonb,tenant_scope text,status public.outbox_status DEFAULT 'pending',attempts int DEFAULT 0,
  max_attempts int DEFAULT 5,next_attempt_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),processed_at timestamptz,
  locked_at timestamptz,locked_by text,last_error text);
