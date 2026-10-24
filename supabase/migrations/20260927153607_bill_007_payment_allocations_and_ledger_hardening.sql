BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE RESTRICT,
  mensalidade_id uuid NULL REFERENCES public.mensalidades(id) ON DELETE RESTRICT,
  fiscal_documento_origem_id uuid NULL REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  natureza text NOT NULL DEFAULT 'aplicacao',
  alocacao_origem_id uuid NULL REFERENCES public.financeiro_pagamento_alocacoes(id) ON DELETE RESTRICT,
  valor_bruto_aoa numeric(18,2) NOT NULL,
  valor_liquido_aoa numeric(18,2) NULL,
  valor_imposto_aoa numeric(18,2) NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_pagamento_alocacoes_natureza_chk
    CHECK (natureza IN ('aplicacao','reversao')),
  CONSTRAINT financeiro_pagamento_alocacoes_valor_chk
    CHECK (valor_bruto_aoa > 0),
  CONSTRAINT financeiro_pagamento_alocacoes_fiscal_totals_chk
    CHECK (
      (fiscal_documento_origem_id IS NULL
        AND valor_liquido_aoa IS NULL
        AND valor_imposto_aoa IS NULL)
      OR
      (fiscal_documento_origem_id IS NOT NULL
        AND valor_liquido_aoa IS NOT NULL
        AND valor_imposto_aoa IS NOT NULL
        AND valor_liquido_aoa >= 0
        AND valor_imposto_aoa >= 0
        AND round(valor_liquido_aoa + valor_imposto_aoa, 2) = round(valor_bruto_aoa, 2))
    ),
  CONSTRAINT financeiro_pagamento_alocacoes_reversal_shape_chk
    CHECK (
      (natureza = 'aplicacao' AND alocacao_origem_id IS NULL)
      OR
      (natureza = 'reversao' AND alocacao_origem_id IS NOT NULL)
    ),
  CONSTRAINT financeiro_pagamento_alocacoes_idempotency_uk UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_pag_aloc_aplicacao_pag_mens
  ON public.financeiro_pagamento_alocacoes(pagamento_id, mensalidade_id)
  WHERE natureza = 'aplicacao';

CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_pag_aloc_reversao_origem
  ON public.financeiro_pagamento_alocacoes(alocacao_origem_id)
  WHERE natureza = 'reversao';

CREATE INDEX IF NOT EXISTS idx_fin_pag_aloc_source_doc
  ON public.financeiro_pagamento_alocacoes(fiscal_documento_origem_id, created_at)
  WHERE fiscal_documento_origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_pag_aloc_pagamento
  ON public.financeiro_pagamento_alocacoes(pagamento_id, created_at);

ALTER TABLE public.financeiro_pagamento_alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_pagamento_alocacoes_select
ON public.financeiro_pagamento_alocacoes;

CREATE POLICY financeiro_pagamento_alocacoes_select
ON public.financeiro_pagamento_alocacoes
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR escola_id = public.current_tenant_escola_id()
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_pagamento_alocacoes.escola_id
      AND eu.user_id = auth.uid()
  )
);

REVOKE ALL ON TABLE public.financeiro_pagamento_alocacoes
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.financeiro_pagamento_alocacoes TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_reversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE RESTRICT,
  motivo text NOT NULL,
  idempotency_key text NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT financeiro_pagamento_reversoes_pagamento_uk UNIQUE (pagamento_id),
  CONSTRAINT financeiro_pagamento_reversoes_idempotency_uk UNIQUE (idempotency_key),
  CONSTRAINT financeiro_pagamento_reversoes_motivo_chk CHECK (length(btrim(motivo)) > 0)
);

ALTER TABLE public.financeiro_pagamento_reversoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_pagamento_reversoes_select
ON public.financeiro_pagamento_reversoes;

CREATE POLICY financeiro_pagamento_reversoes_select
ON public.financeiro_pagamento_reversoes
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR escola_id = public.current_tenant_escola_id()
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_pagamento_reversoes.escola_id
      AND eu.user_id = auth.uid()
  )
);

REVOKE ALL ON TABLE public.financeiro_pagamento_reversoes
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.financeiro_pagamento_reversoes TO authenticated, service_role;

ALTER TABLE public.financeiro_estornos
  ADD COLUMN IF NOT EXISTS pagamento_id uuid NULL,
  ADD COLUMN IF NOT EXISTS alocacao_id uuid NULL,
  ADD COLUMN IF NOT EXISTS reversao_id uuid NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

ALTER TABLE public.financeiro_estornos
  DROP CONSTRAINT IF EXISTS financeiro_estornos_pagamento_id_fkey,
  DROP CONSTRAINT IF EXISTS financeiro_estornos_alocacao_id_fkey,
  DROP CONSTRAINT IF EXISTS financeiro_estornos_reversao_id_fkey;

ALTER TABLE public.financeiro_estornos
  ADD CONSTRAINT financeiro_estornos_pagamento_id_fkey
    FOREIGN KEY (pagamento_id) REFERENCES public.pagamentos(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financeiro_estornos_alocacao_id_fkey
    FOREIGN KEY (alocacao_id) REFERENCES public.financeiro_pagamento_alocacoes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financeiro_estornos_reversao_id_fkey
    FOREIGN KEY (reversao_id) REFERENCES public.financeiro_pagamento_reversoes(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_financeiro_estornos_idempotency
  ON public.financeiro_estornos(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.financeiro_ledger
  DROP CONSTRAINT IF EXISTS financeiro_ledger_aluno_id_fkey,
  DROP CONSTRAINT IF EXISTS financeiro_ledger_escola_id_fkey;

ALTER TABLE public.financeiro_ledger
  ADD CONSTRAINT financeiro_ledger_aluno_id_fkey
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financeiro_ledger_escola_id_fkey
    FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_estornos
  DROP CONSTRAINT IF EXISTS financeiro_estornos_escola_id_fkey,
  DROP CONSTRAINT IF EXISTS financeiro_estornos_mensalidade_id_fkey;

ALTER TABLE public.financeiro_estornos
  ADD CONSTRAINT financeiro_estornos_escola_id_fkey
    FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financeiro_estornos_mensalidade_id_fkey
    FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.financeiro_block_immutable_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: histórico financeiro append-only não pode ser alterado ou apagado';
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fin_pag_aloc_immutable ON public.financeiro_pagamento_alocacoes;
CREATE TRIGGER trg_fin_pag_aloc_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_pagamento_alocacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_immutable_row();

DROP TRIGGER IF EXISTS trg_fin_pag_reversao_immutable ON public.financeiro_pagamento_reversoes;
CREATE TRIGGER trg_fin_pag_reversao_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_pagamento_reversoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_immutable_row();

DROP TRIGGER IF EXISTS trg_fin_ledger_immutable ON public.financeiro_ledger;
CREATE TRIGGER trg_fin_ledger_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_ledger
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_immutable_row();

DROP TRIGGER IF EXISTS trg_fin_estornos_immutable ON public.financeiro_estornos;
CREATE TRIGGER trg_fin_estornos_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_estornos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_immutable_row();

CREATE OR REPLACE FUNCTION public.financeiro_block_pagamento_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: pagamento não pode ser apagado; use reversão';
END;
$bill$;

DROP TRIGGER IF EXISTS trg_pagamentos_no_delete ON public.pagamentos;
CREATE TRIGGER trg_pagamentos_no_delete
BEFORE DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_pagamento_delete();

CREATE OR REPLACE FUNCTION public.financeiro_guard_mensalidade_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.mensalidade_id = OLD.id)
     OR EXISTS (
       SELECT 1 FROM public.financeiro_ledger l
       WHERE l.referencia_tabela = 'mensalidades' AND l.referencia_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'IMMUTABILITY: mensalidade com histórico financeiro não pode ser apagada';
  END IF;
  RETURN OLD;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_mensalidades_finance_history_no_delete ON public.mensalidades;
CREATE TRIGGER trg_mensalidades_finance_history_no_delete
BEFORE DELETE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.financeiro_guard_mensalidade_delete();

DROP POLICY IF EXISTS "Acesso Ledger por Escola" ON public.financeiro_ledger;
DROP POLICY IF EXISTS estornos_tenant_isolation ON public.financeiro_estornos;

CREATE POLICY financeiro_ledger_select
ON public.financeiro_ledger
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR escola_id = public.current_tenant_escola_id()
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_ledger.escola_id
      AND eu.user_id = auth.uid()
  )
);

CREATE POLICY financeiro_estornos_select
ON public.financeiro_estornos
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR escola_id = public.current_tenant_escola_id()
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_estornos.escola_id
      AND eu.user_id = auth.uid()
  )
);

REVOKE ALL ON TABLE public.financeiro_ledger FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financeiro_ledger FROM authenticated, service_role;
GRANT SELECT ON TABLE public.financeiro_ledger TO authenticated, service_role;

REVOKE ALL ON TABLE public.financeiro_estornos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financeiro_estornos FROM authenticated, service_role;
GRANT SELECT ON TABLE public.financeiro_estornos TO authenticated, service_role;

DROP POLICY IF EXISTS pagamentos_delete ON public.pagamentos;
REVOKE DELETE, TRUNCATE ON TABLE public.pagamentos FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_ledger_insert_once(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_tipo public.financeiro_tipo_transacao,
  p_origem public.financeiro_origem,
  p_referencia_tabela text,
  p_referencia_id uuid,
  p_tipo_evento text,
  p_versao_evento integer,
  p_event_key text,
  p_valor numeric,
  p_data_competencia date,
  p_descricao text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions'
AS $bill$
BEGIN
  IF p_escola_id IS NULL OR p_aluno_id IS NULL OR p_referencia_id IS NULL THEN
    RAISE EXCEPTION 'DATA: ledger exige escola, aluno e referência';
  END IF;
  IF COALESCE(p_valor,0) < 0 THEN
    RAISE EXCEPTION 'DATA: valor do ledger não pode ser negativo';
  END IF;

  INSERT INTO public.financeiro_ledger (
    escola_id, aluno_id, tipo, origem, referencia_tabela, referencia_id,
    tipo_evento, versao_evento, event_key, valor, data_competencia,
    descricao, metadata
  )
  VALUES (
    p_escola_id, p_aluno_id, p_tipo, p_origem, p_referencia_tabela,
    p_referencia_id, p_tipo_evento, p_versao_evento, p_event_key,
    p_valor, p_data_competencia, p_descricao, COALESCE(p_metadata,'{}'::jsonb)
  )
  ON CONFLICT (event_key) DO NOTHING;
END;
$bill$;

REVOKE EXECUTE ON FUNCTION public.fn_ledger_insert_once(
  uuid,uuid,public.financeiro_tipo_transacao,public.financeiro_origem,
  text,uuid,text,integer,text,numeric,date,text,jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_sync_financeiro_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions'
AS $bill$
BEGIN
  IF TG_TABLE_NAME = 'mensalidades' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.fn_ledger_insert_once(
        NEW.escola_id, NEW.aluno_id, 'debito', 'mensalidade',
        'mensalidades', NEW.id, 'criado', 1,
        format('mensalidades:%s:criado:v1', NEW.id::text),
        COALESCE(NEW.valor_previsto, NEW.valor),
        make_date(
          COALESCE(NEW.ano_referencia, EXTRACT(YEAR FROM NEW.data_vencimento)::int),
          COALESCE(NEW.mes_referencia, EXTRACT(MONTH FROM NEW.data_vencimento)::int),
          1
        ),
        'Lançamento de mensalidade: ' || COALESCE(NEW.mes_referencia::text,'') || '/' || COALESCE(NEW.ano_referencia::text,''),
        '{}'::jsonb
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto OR OLD.valor IS DISTINCT FROM NEW.valor THEN
        PERFORM public.fn_ledger_insert_once(
          NEW.escola_id, NEW.aluno_id,
          CASE
            WHEN COALESCE(NEW.valor_previsto,NEW.valor) > COALESCE(OLD.valor_previsto,OLD.valor)
              THEN 'debito'::public.financeiro_tipo_transacao
            ELSE 'credito'::public.financeiro_tipo_transacao
          END,
          'ajuste', 'mensalidades', NEW.id, 'ajuste_valor', 1,
          format('mensalidades:%s:ajuste_valor:%s',NEW.id::text,clock_timestamp()::text),
          ABS(COALESCE(NEW.valor_previsto,NEW.valor) - COALESCE(OLD.valor_previsto,OLD.valor)),
          make_date(
            COALESCE(NEW.ano_referencia,EXTRACT(YEAR FROM NEW.data_vencimento)::int),
            COALESCE(NEW.mes_referencia,EXTRACT(MONTH FROM NEW.data_vencimento)::int),
            1
          ),
          'Ajuste de valor de mensalidade',
          '{}'::jsonb
        );
      END IF;

      IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado' THEN
        PERFORM public.fn_ledger_insert_once(
          NEW.escola_id, NEW.aluno_id, 'credito', 'estorno',
          'mensalidades', NEW.id, 'cancelado', 1,
          format('mensalidades:%s:cancelado:v1',NEW.id::text),
          COALESCE(NEW.valor_previsto,NEW.valor),
          make_date(
            COALESCE(NEW.ano_referencia,EXTRACT(YEAR FROM NEW.data_vencimento)::int),
            COALESCE(NEW.mes_referencia,EXTRACT(MONTH FROM NEW.data_vencimento)::int),
            1
          ),
          'Estorno por cancelamento de mensalidade',
          '{}'::jsonb
        );
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'pagamentos' THEN
    IF NEW.status IN ('settled','concluido','pago')
       AND (TG_OP = 'INSERT' OR COALESCE(OLD.status,'') NOT IN ('settled','concluido','pago')) THEN
      PERFORM public.fn_ledger_insert_once(
        NEW.escola_id, NEW.aluno_id, 'credito', 'mensalidade',
        'pagamentos', NEW.id, 'liquidado', 1,
        format('pagamentos:%s:liquidado:v1',NEW.id::text),
        NEW.valor_pago,
        COALESCE(NEW.data_pagamento,NEW.created_at::date),
        'Recebimento de pagamento',
        jsonb_build_object('metodo',NEW.metodo,'referencia',COALESCE(NEW.reference,NEW.referencia))
      );
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status IN ('settled','concluido','pago')
       AND NEW.status IN ('voided','estornado','cancelado','rejeitado','rejected') THEN
      PERFORM public.fn_ledger_insert_once(
        NEW.escola_id, NEW.aluno_id, 'debito', 'estorno',
        'pagamentos', NEW.id, NEW.status, 1,
        format('pagamentos:%s:%s:v1',NEW.id::text,NEW.status),
        NEW.valor_pago,
        COALESCE(NEW.data_pagamento,NEW.created_at::date),
        'Reversão de pagamento liquidado',
        jsonb_build_object(
          'metodo',NEW.metodo,
          'referencia',COALESCE(NEW.reference,NEW.referencia),
          'status',NEW.status
        )
      );
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'financeiro_lancamentos' THEN
    IF TG_OP = 'INSERT' AND NEW.origem = 'venda_avulsa' THEN
      PERFORM public.fn_ledger_insert_once(
        NEW.escola_id, NEW.aluno_id, NEW.tipo, 'venda_avulsa',
        'financeiro_lancamentos', NEW.id, 'criado', 1,
        format('financeiro_lancamentos:%s:criado:v1',NEW.id::text),
        NEW.valor_total,
        COALESCE(NEW.data_pagamento::date,NEW.created_at::date),
        NEW.descricao,
        '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$bill$;

REVOKE EXECUTE ON FUNCTION public.fn_sync_financeiro_ledger()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;