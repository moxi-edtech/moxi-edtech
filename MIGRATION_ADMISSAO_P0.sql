-- MIGRATION_ADMISSAO_P0.sql

-- 1. Add expires_at column to candidaturas table
ALTER TABLE public.candidaturas
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Add a check constraint for the new status values
-- Includes old values to avoid breaking existing data.
-- The new flow should only use the new values.
-- ALTER TABLE public.candidaturas
-- ADD CONSTRAINT chk_candidaturas_status CHECK (status IN ('NOVOS_ONLINE', 'EM_ANALISE', 'AGUARDANDO_PAGAMENTO', 'CONVERTIDO', 'pendente', 'matriculado', 'rejeitada', 'cancelada'));

-- 3. Create indexes for the new admission flow

-- Index for the Radar de Admissões dashboard
CREATE INDEX IF NOT EXISTS ix_candidaturas_escola_status_created_at_desc
ON public.candidaturas (escola_id, status, created_at DESC);

-- Unique partial indexes for deduplication
-- Using expressions to index values within the 'dados_candidato' JSONB column.
-- Note: These indexes require that the values are not empty strings.

-- Dedupe by bi_numero
CREATE UNIQUE INDEX IF NOT EXISTS uix_candidaturas_escola_bi_numero
ON public.candidaturas (escola_id, (dados_candidato->>'bi_numero'))
WHERE (dados_candidato->>'bi_numero') IS NOT NULL AND (dados_candidato->>'bi_numero') <> '';

-- Dedupe by telefone
CREATE UNIQUE INDEX IF NOT EXISTS uix_candidaturas_escola_telefone
ON public.candidaturas (escola_id, (dados_candidato->>'telefone'))
WHERE (dados_candidato->>'telefone') IS NOT NULL AND (dados_candidato->>'telefone') <> '';

-- Dedupe by email
CREATE UNIQUE INDEX IF NOT EXISTS uix_candidaturas_escola_email
ON public.candidaturas (escola_id, (dados_candidato->>'email'))
WHERE (dados_candidato->>'email') IS NOT NULL AND (dados_candidato->>'email') <> '';

-- Add expires_at to candidaturas table for AGUARDANDO_PAGAMENTO status
ALTER TABLE public.candidaturas
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Grant usage to relevant roles
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidaturas TO service_role;

-- 4. Idempotency Keys table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  escola_id uuid not null,
  key text not null,
  scope text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  PRIMARY KEY (escola_id, scope, key)
);
GRANT SELECT, INSERT ON TABLE public.idempotency_keys TO authenticated;


-- 5. RPCs for the new admission flow

CREATE OR REPLACE FUNCTION public.admissao_upsert_draft(
  p_escola_id uuid,
  p_source text,
  p_dados_candidato jsonb
)
RETURNS uuid AS $$
DECLARE
  v_candidatura_id uuid;
  v_bi_numero text;
  v_telefone text;
  v_email text;
  v_existing_id uuid;
BEGIN
  v_bi_numero := p_dados_candidato->>'bi_numero';
  v_telefone := p_dados_candidato->>'telefone';
  v_email := p_dados_candidato->>'email';

  -- Deduplication logic
  IF v_bi_numero IS NOT NULL AND v_bi_numero <> '' THEN
    SELECT id INTO v_existing_id FROM public.candidaturas WHERE escola_id = p_escola_id AND dados_candidato->>'bi_numero' = v_bi_numero;
  END IF;

  IF v_existing_id IS NULL AND v_telefone IS NOT NULL AND v_telefone <> '' THEN
    SELECT id INTO v_existing_id FROM public.candidaturas WHERE escola_id = p_escola_id AND dados_candidato->>'telefone' = v_telefone;
  END IF;

  IF v_existing_id IS NULL AND v_email IS NOT NULL AND v_email <> '' THEN
    SELECT id INTO v_existing_id FROM public.candidaturas WHERE escola_id = p_escola_id AND dados_candidato->>'email' = v_email;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing candidatura
    UPDATE public.candidaturas
    SET
      dados_candidato = dados_candidato || p_dados_candidato, -- Merge JSONB data
      nome_candidato = COALESCE(p_dados_candidato->>'nome_candidato', nome_candidato),
      curso_id = COALESCE((p_dados_candidato->>'curso_id')::uuid, curso_id),
      classe_id = COALESCE((p_dados_candidato->>'classe_id')::uuid, classe_id)
    WHERE id = v_existing_id
    RETURNING id INTO v_candidatura_id;
  ELSE
    -- Insert new candidatura
    INSERT INTO public.candidaturas (escola_id, status, dados_candidato, nome_candidato, curso_id, classe_id, ano_letivo)
    VALUES (
      p_escola_id,
      CASE WHEN p_source = 'online' THEN 'NOVOS_ONLINE' ELSE 'EM_ANALISE' END,
      p_dados_candidato,
      p_dados_candidato->>'nome_candidato',
      (p_dados_candidato->>'curso_id')::uuid,
      (p_dados_candidato->>'classe_id')::uuid,
      (SELECT ano_letivo FROM public.school_sessions WHERE escola_id = p_escola_id AND status = 'ativo' LIMIT 1) -- Assumes an active school session
    )
    RETURNING id INTO v_candidatura_id;
  END IF;
  
  -- Audit
  INSERT INTO public.audit_logs (escola_id, portal, action, entity, entity_id, details, user_id)
  VALUES (p_escola_id, 'secretaria', 'ADMISSION_DRAFT_SAVED', 'candidaturas', v_candidatura_id, jsonb_build_object('source', p_source), auth.uid());

  -- Outbox
  INSERT INTO public.outbox_events (escola_id, event_type, payload)
  VALUES (p_escola_id, 'ADMISSION_DRAFT_SAVED', jsonb_build_object('candidatura_id', v_candidatura_id));

  RETURN v_candidatura_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admissao_convert(
  p_candidatura_id uuid,
  p_turma_id uuid,
  p_metodo_pagamento text,
  p_comprovativo_url text,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS JSONB AS $$
DECLARE
  v_candidatura public.candidaturas;
  v_turma public.turmas;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_mensalidade_id uuid;
  v_pagamento_id uuid;
  v_escola_id uuid;
  v_valor_matricula numeric;
  v_payment_result jsonb;
  v_final_result jsonb;
  v_existing_result jsonb;
BEGIN
  SELECT * INTO v_candidatura FROM public.candidaturas WHERE id = p_candidatura_id;
  v_escola_id := v_candidatura.escola_id;

  -- Idempotency Check
  SELECT result INTO v_existing_result FROM public.idempotency_keys WHERE escola_id = v_escola_id AND key = p_idempotency_key AND scope = 'admissao_convert';
  IF v_existing_result IS NOT NULL THEN
      RETURN v_existing_result;
  END IF;
  
  SELECT * INTO v_turma FROM public.turmas WHERE id = p_turma_id;

  -- 1. Resolve Preço da Matrícula
  SELECT valor_matricula INTO v_valor_matricula
  FROM public.financeiro_tabelas
  WHERE escola_id = v_escola_id
    AND ano_letivo = v_candidatura.ano_letivo
    AND curso_id = v_turma.curso_id
    AND classe_id = v_turma.classe_id
  LIMIT 1;

  IF v_valor_matricula IS NULL THEN
      SELECT valor_matricula INTO v_valor_matricula
      FROM public.financeiro_tabelas
      WHERE escola_id = v_escola_id
        AND ano_letivo = v_candidatura.ano_letivo
        AND curso_id = v_turma.curso_id
        AND classe_id IS NULL
      LIMIT 1;
  END IF;
  v_valor_matricula := COALESCE(v_valor_matricula, 0);

  -- 2. Upsert Aluno
  IF v_candidatura.aluno_id IS NOT NULL THEN
    v_aluno_id := v_candidatura.aluno_id;
  ELSE
    INSERT INTO public.alunos (escola_id, nome, email, telefone, dados_adicionais)
    VALUES (
      v_escola_id, v_candidatura.nome_candidato, v_candidatura.dados_candidato->>'email',
      v_candidatura.dados_candidato->>'telefone', v_candidatura.dados_candidato
    ) RETURNING id INTO v_aluno_id;
    UPDATE public.candidaturas SET aluno_id = v_aluno_id WHERE id = p_candidatura_id;
  END IF;

  -- 3. Create Matricula
  INSERT INTO public.matriculas (aluno_id, turma_id, escola_id, ano_letivo, status, data_matricula)
  VALUES (v_aluno_id, p_turma_id, v_escola_id, v_candidatura.ano_letivo, 'ativa', CURRENT_DATE)
  RETURNING id INTO v_matricula_id;

  -- 4. Create Mensalidade for the matricula fee
  INSERT INTO public.mensalidades (escola_id, aluno_id, matricula_id, valor, tipo)
  VALUES (v_escola_id, v_aluno_id, v_matricula_id, v_valor_matricula, 'matricula')
  RETURNING id INTO v_mensalidade_id;

  -- 5. Register payment if immediate
  IF p_metodo_pagamento IN ('CASH', 'TPA') THEN
    v_payment_result := public.registrar_pagamento(v_mensalidade_id, p_metodo_pagamento, 'Pagamento de matrícula via admissão');
    v_pagamento_id := (v_payment_result->>'pagamento_id')::uuid;
  END IF;

  -- 6. Update Candidatura Status
  UPDATE public.candidaturas SET status = 'CONVERTIDO' WHERE id = p_candidatura_id;

  v_final_result := jsonb_build_object('ok', true, 'aluno_id', v_aluno_id, 'matricula_id', v_matricula_id, 'pagamento_id', v_pagamento_id);

  -- 7. Persist Idempotency Key
  INSERT INTO public.idempotency_keys(escola_id, key, scope, result)
  VALUES (v_escola_id, p_idempotency_key, 'admissao_convert', v_final_result);

  -- 8. Audit & Outbox
  INSERT INTO public.audit_logs (escola_id, portal, action, entity, entity_id, details, user_id)
  VALUES 
    (v_escola_id, 'secretaria', 'MATRICULA_CREATED', 'matriculas', v_matricula_id, jsonb_build_object('source', 'candidatura')),
    (v_escola_id, 'secretaria', 'MENSALIDADE_CREATED', 'mensalidades', v_mensalidade_id, jsonb_build_object('type', 'matricula', 'value', v_valor_matricula)),
    (v_escola_id, 'secretaria', 'ADMISSION_CONVERTED', 'candidaturas', p_candidatura_id, jsonb_build_object('idempotency_key', p_idempotency_key));
  
  INSERT INTO public.outbox_events (escola_id, event_type, payload)
  VALUES 
    (v_escola_id, 'MATRICULA_CREATED', jsonb_build_object('matricula_id', v_matricula_id, 'aluno_id', v_aluno_id)),
    (v_escola_id, 'ADMISSION_CONVERTED', jsonb_build_object('candidatura_id', p_candidatura_id));

  IF v_pagamento_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (escola_id, portal, action, entity, entity_id, details, user_id)
    VALUES (v_escola_id, 'secretaria', 'FINANCE_PAYMENT_CONFIRMED', 'pagamentos', v_pagamento_id, jsonb_build_object('method', p_metodo_pagamento));
    
    INSERT INTO public.outbox_events (escola_id, event_type, payload)
    VALUES (v_escola_id, 'FINANCE_PAYMENT_CONFIRMED', jsonb_build_object('pagamento_id', v_pagamento_id, 'matricula_id', v_matricula_id));
  END IF;

  RETURN v_final_result;
END;
$$ LANGUAGE plpgsql;
ALTER TABLE public.candidaturas ADD COLUMN IF NOT EXISTS ficha_pdf_path TEXT;