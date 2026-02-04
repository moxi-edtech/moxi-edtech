BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_status') THEN
    CREATE TYPE public.pagamento_status AS ENUM ('pending','settled','rejected','voided');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_metodo') THEN
    CREATE TYPE public.pagamento_metodo AS ENUM ('cash','tpa','transfer','mcx');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fecho_status') THEN
    CREATE TYPE public.fecho_status AS ENUM ('draft','declared','approved','rejected');
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_metodo_pagamento_check') THEN
    ALTER TABLE public.pagamentos DROP CONSTRAINT pagamentos_metodo_pagamento_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_status_check') THEN
    ALTER TABLE public.pagamentos DROP CONSTRAINT pagamentos_status_check;
  END IF;
END
$$;

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS aluno_id uuid,
  ADD COLUMN IF NOT EXISTS status public.pagamento_status,
  ADD COLUMN IF NOT EXISTS metodo public.pagamento_metodo,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS gateway_ref text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS day_key date NOT NULL DEFAULT (now() at time zone 'Africa/Luanda')::date,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.pagamentos
SET status = CASE
  WHEN status IN ('pendente') THEN 'pending'
  WHEN status IN ('concluido','pago') THEN 'settled'
  WHEN status IN ('falhado') THEN 'rejected'
  WHEN status IN ('estornado') THEN 'voided'
  ELSE COALESCE(status, 'settled')
END
WHERE status IS NOT NULL;

UPDATE public.pagamentos
SET metodo = CASE COALESCE(metodo, metodo_pagamento)
  WHEN 'dinheiro' THEN 'cash'
  WHEN 'tpa_fisico' THEN 'tpa'
  WHEN 'tpa' THEN 'tpa'
  WHEN 'multicaixa' THEN 'tpa'
  WHEN 'mcx_express' THEN 'mcx'
  WHEN 'transferencia' THEN 'transfer'
  WHEN 'referencia' THEN 'transfer'
  WHEN 'deposito' THEN 'transfer'
  ELSE metodo
END
WHERE COALESCE(metodo, metodo_pagamento) IS NOT NULL;

UPDATE public.pagamentos SET status = 'settled' WHERE status IS NULL;
UPDATE public.pagamentos SET metodo = 'cash' WHERE metodo IS NULL;

ALTER TABLE public.pagamentos
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN metodo DROP DEFAULT;

-- Mantém tipos text para evitar dependências de view/materialized views.

ALTER TABLE public.pagamentos
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'settled',
  ALTER COLUMN metodo SET NOT NULL,
  ALTER COLUMN metodo SET DEFAULT 'cash';

UPDATE public.pagamentos
SET settled_at = COALESCE(settled_at, created_at, now())
WHERE status = 'settled'
  AND settled_at IS NULL;

UPDATE public.pagamentos
SET created_by = COALESCE(created_by, settled_by);

UPDATE public.pagamentos
SET settled_by = COALESCE(settled_by, created_by)
WHERE status = 'settled'
  AND settled_by IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_ref_required_for_tpa') THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_ref_required_for_tpa
      CHECK (metodo <> 'tpa' OR (reference IS NOT NULL AND length(trim(reference)) > 0))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_evidence_required_for_transfer') THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_evidence_required_for_transfer
      CHECK (metodo <> 'transfer' OR (evidence_url IS NOT NULL AND length(trim(evidence_url)) > 0))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_settled_fields') THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_settled_fields
      CHECK (status <> 'settled' OR settled_at IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_day ON public.pagamentos (escola_id, day_key);
CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_status ON public.pagamentos (escola_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_metodo ON public.pagamentos (escola_id, metodo);

ALTER TABLE public.fecho_caixa
  ADD COLUMN IF NOT EXISTS day_key date,
  ADD COLUMN IF NOT EXISTS declared_by uuid,
  ADD COLUMN IF NOT EXISTS declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS declared_cash numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declared_tpa numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declared_transfer numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declared_mcx numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_cash numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_tpa numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_transfer numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_mcx numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

UPDATE public.fecho_caixa
SET day_key = COALESCE(day_key, data_fecho),
    declared_by = COALESCE(declared_by, operador_id),
    declared_at = COALESCE(declared_at, created_at),
    declared_cash = COALESCE(declared_cash, valor_declarado_especie, 0),
    declared_tpa = COALESCE(declared_tpa, valor_declarado_tpa, 0),
    declared_transfer = COALESCE(declared_transfer, valor_declarado_transferencia, 0),
    system_cash = COALESCE(system_cash, valor_sistema_especie, 0),
    system_tpa = COALESCE(system_tpa, valor_sistema_tpa, 0),
    system_transfer = COALESCE(system_transfer, valor_sistema_transferencia, 0),
    approved_by = COALESCE(approved_by, aprovado_por),
    approved_at = COALESCE(approved_at, aprovado_em),
    approval_note = COALESCE(approval_note, observacao_aprovador);

UPDATE public.fecho_caixa
SET status = CASE status
  WHEN 'declarado' THEN 'declared'
  WHEN 'aprovado' THEN 'approved'
  WHEN 'rejeitado' THEN 'rejected'
  ELSE COALESCE(status, 'draft')
END
WHERE status IS NOT NULL;

-- Mantém status como text para evitar conflitos com legado.

UPDATE public.fecho_caixa SET day_key = COALESCE(day_key, current_date) WHERE day_key IS NULL;

ALTER TABLE public.fecho_caixa
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN day_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fecho_unique_day ON public.fecho_caixa (escola_id, day_key);

ALTER TABLE public.conciliacao_uploads
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS range_start date,
  ADD COLUMN IF NOT EXISTS range_end date,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.conciliacao_uploads
SET storage_path = COALESCE(storage_path, file_path);

UPDATE public.conciliacao_uploads
SET range_start = COALESCE(range_start, uploaded_at::date),
    range_end = COALESCE(range_end, uploaded_at::date)
WHERE range_start IS NULL OR range_end IS NULL;

ALTER TABLE public.conciliacao_uploads
  ALTER COLUMN status SET DEFAULT 'uploaded';

UPDATE public.conciliacao_uploads
SET status = CASE status
  WHEN 'pending_parsing' THEN 'uploaded'
  WHEN 'error' THEN 'uploaded'
  ELSE status
END
WHERE status IN ('pending_parsing', 'error');

CREATE INDEX IF NOT EXISTS idx_conc_upload_escola_range
  ON public.conciliacao_uploads (escola_id, range_start, range_end);

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagamentos_select_secretaria_own ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_secretaria ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_financeiro ON public.pagamentos;

CREATE POLICY pagamentos_select_secretaria_own
ON public.pagamentos
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND (
    created_by = auth.uid()
    OR user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
  )
);

CREATE POLICY pagamentos_insert_secretaria
ON public.pagamentos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['secretaria','financeiro','admin','global_admin','super_admin'])
);

CREATE POLICY pagamentos_update_financeiro
ON public.pagamentos
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
);

ALTER TABLE public.fecho_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios fechos de caixa" ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_select ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_declare_secretaria ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_update_secretaria ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_approve_financeiro ON public.fecho_caixa;

CREATE POLICY fecho_select
ON public.fecho_caixa
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND (
    declared_by = auth.uid()
    OR user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
  )
);

CREATE POLICY fecho_declare_secretaria
ON public.fecho_caixa
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['secretaria','admin','global_admin','super_admin'])
);

CREATE POLICY fecho_update_secretaria
ON public.fecho_caixa
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['secretaria','admin','global_admin','super_admin'])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['secretaria','admin','global_admin','super_admin'])
);

CREATE POLICY fecho_approve_financeiro
ON public.fecho_caixa
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
);

ALTER TABLE public.conciliacao_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar seus próprios uploads" ON public.conciliacao_uploads;
DROP POLICY IF EXISTS conc_upload_select_financeiro ON public.conciliacao_uploads;
DROP POLICY IF EXISTS conc_upload_insert_financeiro ON public.conciliacao_uploads;

CREATE POLICY conc_upload_select_financeiro
ON public.conciliacao_uploads
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
);

CREATE POLICY conc_upload_insert_financeiro
ON public.conciliacao_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['financeiro','admin','global_admin','super_admin'])
);

CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamento_secretaria(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_mensalidade_id uuid,
  p_valor numeric,
  p_metodo public.pagamento_metodo,
  p_reference text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_status public.pagamento_status;
  v_legacy_metodo text;
  v_registro jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_metodo = 'cash' THEN
    v_status := 'settled';
  ELSE
    v_status := 'pending';
  END IF;

  IF p_metodo = 'tpa' AND (p_reference IS NULL OR length(trim(p_reference)) = 0) THEN
    RAISE EXCEPTION 'reference_required_for_tpa';
  END IF;

  IF p_metodo = 'transfer' AND (p_evidence_url IS NULL OR length(trim(p_evidence_url)) = 0) THEN
    RAISE EXCEPTION 'evidence_required_for_transfer';
  END IF;

  v_legacy_metodo := CASE p_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    ELSE 'dinheiro'
  END;

  INSERT INTO public.pagamentos (
    escola_id,
    aluno_id,
    mensalidade_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    reference,
    evidence_url,
    gateway_ref,
    created_by,
    settled_at,
    settled_by,
    meta
  ) VALUES (
    p_escola_id,
    p_aluno_id,
    p_mensalidade_id,
    p_valor,
    CURRENT_DATE,
    p_metodo,
    v_legacy_metodo,
    v_status,
    p_reference,
    p_evidence_url,
    p_gateway_ref,
    auth.uid(),
    CASE WHEN v_status = 'settled' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'settled' THEN auth.uid() ELSE NULL END,
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  IF v_status = 'settled' AND p_mensalidade_id IS NOT NULL THEN
    SELECT public.registrar_pagamento(
      p_mensalidade_id,
      v_legacy_metodo,
      COALESCE(p_meta->>'observacao', 'Pagamento via balcão')
    ) INTO v_registro;

    IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'mensalidade_update_failed';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_settle_pagamento(
  p_escola_id uuid,
  p_pagamento_id uuid,
  p_settle_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_mensalidade_status text;
  v_legacy_metodo text;
  v_registro jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.pagamentos
  SET status = 'settled',
      settled_at = now(),
      settled_by = auth.uid(),
      meta = meta || jsonb_build_object('settle_meta', COALESCE(p_settle_meta, '{}'::jsonb))
  WHERE id = p_pagamento_id
    AND escola_id = p_escola_id
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_pending';
  END IF;

  IF v_row.mensalidade_id IS NOT NULL THEN
    SELECT status INTO v_mensalidade_status
    FROM public.mensalidades
    WHERE id = v_row.mensalidade_id;

    IF v_mensalidade_status IS DISTINCT FROM 'pago' THEN
      v_legacy_metodo := CASE v_row.metodo
        WHEN 'cash' THEN 'dinheiro'
        WHEN 'tpa' THEN 'tpa'
        WHEN 'transfer' THEN 'transferencia'
        WHEN 'mcx' THEN 'multicaixa'
        ELSE 'dinheiro'
      END;

      SELECT public.registrar_pagamento(
        v_row.mensalidade_id,
        v_legacy_metodo,
        COALESCE(p_settle_meta->>'observacao', 'Pagamento conciliado')
      ) INTO v_registro;

      IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'mensalidade_update_failed';
      END IF;
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_fecho_declarar_e_snapshot(
  p_escola_id uuid,
  p_day_key date,
  p_cash numeric,
  p_tpa numeric,
  p_transfer numeric,
  p_mcx numeric
)
RETURNS public.fecho_caixa
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.fecho_caixa%ROWTYPE;
  v_sys_cash numeric := 0;
  v_sys_tpa numeric := 0;
  v_sys_transfer numeric := 0;
  v_sys_mcx numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT
    COALESCE(SUM(valor_pago) FILTER (WHERE metodo = 'cash' AND status = 'settled'), 0),
    COALESCE(SUM(valor_pago) FILTER (WHERE metodo = 'tpa' AND status = 'settled'), 0),
    COALESCE(SUM(valor_pago) FILTER (WHERE metodo = 'transfer' AND status = 'settled'), 0),
    COALESCE(SUM(valor_pago) FILTER (WHERE metodo = 'mcx' AND status = 'settled'), 0)
  INTO v_sys_cash, v_sys_tpa, v_sys_transfer, v_sys_mcx
  FROM public.pagamentos
  WHERE escola_id = p_escola_id
    AND day_key = p_day_key;

  INSERT INTO public.fecho_caixa (
    escola_id,
    day_key,
    status,
    declared_by,
    declared_at,
    declared_cash,
    declared_tpa,
    declared_transfer,
    declared_mcx,
    system_cash,
    system_tpa,
    system_transfer,
    system_mcx,
    system_calculated_at
  ) VALUES (
    p_escola_id,
    p_day_key,
    'declared',
    auth.uid(),
    now(),
    p_cash,
    p_tpa,
    p_transfer,
    p_mcx,
    v_sys_cash,
    v_sys_tpa,
    v_sys_transfer,
    v_sys_mcx,
    now()
  )
  ON CONFLICT (escola_id, day_key)
  DO UPDATE SET
    status = 'declared',
    declared_by = excluded.declared_by,
    declared_at = excluded.declared_at,
    declared_cash = excluded.declared_cash,
    declared_tpa = excluded.declared_tpa,
    declared_transfer = excluded.declared_transfer,
    declared_mcx = excluded.declared_mcx,
    system_cash = excluded.system_cash,
    system_tpa = excluded.system_tpa,
    system_transfer = excluded.system_transfer,
    system_mcx = excluded.system_mcx,
    system_calculated_at = excluded.system_calculated_at,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;
