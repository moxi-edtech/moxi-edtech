-- KLASSE PR #455: esquema mínimo isolado para exercitar a migração em PostgreSQL 17.
-- Não é um clone da produção; a homologação integrada em Supabase permanece necessária.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.escola_users(
  escola_id uuid NOT NULL, user_id uuid NOT NULL, papel text NOT NULL,
  PRIMARY KEY (escola_id,user_id)
);
CREATE TABLE public.anos_letivos(
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL, ano integer NOT NULL,
  data_inicio date NOT NULL, data_fim date NOT NULL,
  ativo boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.turmas(
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  curso_id uuid,
  classe_id uuid
);
CREATE TABLE public.candidaturas(
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  aluno_id uuid,
  ano_letivo integer,
  status text NOT NULL,
  matricula_id uuid,
  percentagem_desconto numeric DEFAULT 0,
  motivo_desconto text
);
CREATE TABLE public.matriculas(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  turma_id uuid,
  ano_letivo integer NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  percentagem_desconto numeric DEFAULT 0,
  motivo_desconto text,
  ativo boolean DEFAULT true,
  data_inicio_financeiro date,
  data_matricula date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(escola_id,aluno_id,ano_letivo)
);
CREATE TABLE public.financeiro_tabelas(
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL, ano_letivo integer NOT NULL,
  curso_id uuid, classe_id uuid,
  valor_mensalidade numeric NOT NULL,
  dia_vencimento integer
);
CREATE OR REPLACE FUNCTION public.is_turma_classe_exame(uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

-- Reproduz a assinatura já instalada em produção, que tem DEFAULT no 4º e 5º parâmetro.
-- CREATE OR REPLACE sem estes defaults falha com PostgreSQL 42P13.
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(
  p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer,
  p_dia_vencimento_default integer DEFAULT 10, p_turma_id uuid DEFAULT NULL::uuid
) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;

CREATE TABLE public.mensalidades(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  matricula_id uuid, turma_id uuid,
  ano_letivo text,
  mes_referencia smallint, ano_referencia integer,
  valor numeric NOT NULL, valor_previsto numeric,
  valor_original numeric,
  desconto_aplicado numeric DEFAULT 0,
  valor_pago_total numeric DEFAULT 0,
  status text DEFAULT 'pendente',
  data_vencimento date NOT NULL,
  fiscal_documento_id uuid, status_fiscal text DEFAULT 'pending',
  observacoes text,
  tabela_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(escola_id,matricula_id,ano_referencia,mes_referencia)
);
CREATE TABLE public.pagamentos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid,
  mensalidade_id uuid NOT NULL REFERENCES public.mensalidades(id),
  valor_pago numeric NOT NULL,
  status text DEFAULT 'settled',
  fiscal_documento_id uuid,
  status_fiscal text DEFAULT 'pending'
);
CREATE TABLE public.audit_logs(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid, actor_id uuid, user_id uuid,
  action text, entity text, entity_id text,
  portal text, details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Instrumentação leve para verificar créditos sem emular a ledger operacional.
CREATE TABLE public.fixture_ledger(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mensalidade_id uuid, tipo text, delta numeric
);
CREATE OR REPLACE FUNCTION public.fixture_ledger_on_mensalidade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.fixture_ledger(mensalidade_id,tipo,delta)
    VALUES (NEW.id,'debito',coalesce(NEW.valor_previsto,NEW.valor));
  ELSIF TG_OP='UPDATE' AND
    coalesce(OLD.valor_previsto,OLD.valor) IS DISTINCT FROM coalesce(NEW.valor_previsto,NEW.valor) THEN
    INSERT INTO public.fixture_ledger(mensalidade_id,tipo,delta)
    VALUES (NEW.id,
      CASE WHEN coalesce(NEW.valor_previsto,NEW.valor) > coalesce(OLD.valor_previsto,OLD.valor)
           THEN 'debito' ELSE 'credito' END,
      abs(coalesce(OLD.valor_previsto,OLD.valor)-coalesce(NEW.valor_previsto,NEW.valor)));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER fixture_mensalidades_ledger
  AFTER INSERT OR UPDATE ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.fixture_ledger_on_mensalidade();
