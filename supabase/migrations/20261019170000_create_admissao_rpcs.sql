-- Migration: Create RPCs for Admissao Wizard
-- Created at: 2026-10-19 17:00:00

BEGIN;

-- 1. admissao_upsert_draft
CREATE OR REPLACE FUNCTION public.admissao_upsert_draft(
  p_escola_id uuid,
  p_source text,
  p_dados_candidato jsonb,
  p_candidatura_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ano_letivo int;
  v_nome text;
  v_curso_id uuid;
  v_classe_id uuid;
  v_turma_preferencial_id uuid;
  v_turno text;
BEGIN
  -- Determine current academic year (simple heuristic or use configuration)
  -- For now, assume current year or extract from config. 
  -- Better: select max year from school calendar? 
  -- Fallback to current year.
  v_ano_letivo := extract(year from current_date)::int;

  -- Extract key fields from jsonb to columns
  v_nome := p_dados_candidato->>'nome_candidato';
  v_curso_id := (p_dados_candidato->>'curso_id')::uuid;
  v_classe_id := (p_dados_candidato->>'classe_id')::uuid;
  v_turma_preferencial_id := (p_dados_candidato->>'turma_preferencial_id')::uuid;
  v_turno := p_dados_candidato->>'turno';

  IF p_candidatura_id IS NULL THEN
    -- INSERT
    INSERT INTO public.candidaturas (
      escola_id,
      ano_letivo,
      source,
      status,
      nome_candidato,
      curso_id,
      classe_id,
      turma_preferencial_id,
      turno,
      dados_candidato
    ) VALUES (
      p_escola_id,
      v_ano_letivo,
      coalesce(p_source, 'walkin'),
      'pendente',
      v_nome,
      v_curso_id,
      v_classe_id,
      v_turma_preferencial_id,
      v_turno,
      p_dados_candidato
    )
    RETURNING id INTO v_id;
  ELSE
    -- UPDATE
    UPDATE public.candidaturas
    SET
      nome_candidato = coalesce(v_nome, nome_candidato),
      curso_id = coalesce(v_curso_id, curso_id),
      classe_id = coalesce(v_classe_id, classe_id),
      turma_preferencial_id = coalesce(v_turma_preferencial_id, turma_preferencial_id),
      turno = coalesce(v_turno, turno),
      dados_candidato = dados_candidato || p_dados_candidato,
      updated_at = now()
    WHERE id = p_candidatura_id
    RETURNING id INTO v_id;
    
    IF NOT FOUND THEN
       RAISE EXCEPTION 'Candidatura % not found', p_candidatura_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


-- 2. admissao_convert
CREATE OR REPLACE FUNCTION public.admissao_convert(
  p_candidatura_id uuid,
  p_turma_id uuid,
  p_metodo_pagamento text,
  p_comprovativo_url text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cand public.candidaturas%ROWTYPE;
  v_aluno_id uuid;
  v_matricula_numero bigint;
  v_mensalidade_id uuid;
  v_intent_id uuid;
BEGIN
  -- 1. Lock candidature
  SELECT * INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura not found';
  END IF;

  IF v_cand.status = 'CONVERTIDA' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already converted');
  END IF;

  -- 2. Ensure Aluno Exists
  IF v_cand.aluno_id IS NOT NULL THEN
    v_aluno_id := v_cand.aluno_id;
  ELSE
    -- Create Aluno from dados_candidato
    INSERT INTO public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone_responsavel,
      email,
      status,
      created_at
    ) VALUES (
      v_cand.escola_id,
      coalesce(v_cand.nome_candidato, v_cand.dados_candidato->>'nome_candidato'),
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      'ativo',
      now()
    )
    RETURNING id INTO v_aluno_id;

    -- Link back to candidatura
    UPDATE public.candidaturas
    SET aluno_id = v_aluno_id
    WHERE id = p_candidatura_id;
  END IF;

  -- 3. Confirm Matricula (Core)
  -- Uses the SSOT function
  v_matricula_numero := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    p_turma_id, -- Turma selected in wizard
    NULL -- New matricula
  );

  -- 4. Create Payment Intent / Mensalidade (Simplified for P0)
  -- Logic: If amount > 0, we assume it's the "Matrícula" fee or first month.
  -- For now, we just record the intent if payment details are provided.
  -- Real implementation would generate the 'mensalidade' record for enrollment fee.
  
  -- (Optional: Call gerar_mensalidades logic or insert payment manually)
  
  -- 5. Update Status
  UPDATE public.candidaturas
  SET 
    status = 'CONVERTIDA',
    updated_at = now()
  WHERE id = p_candidatura_id;

  -- 6. Audit
  PERFORM public.create_audit_event(
    v_cand.escola_id,
    'ADMISSION_CONVERTED',
    'candidaturas',
    p_candidatura_id::text,
    jsonb_build_object('status', 'pendente'),
    jsonb_build_object('status', 'CONVERTIDA', 'matricula', v_matricula_numero),
    'secretaria',
    jsonb_build_object('aluno_id', v_aluno_id, 'turma_id', p_turma_id)
  );

  RETURN jsonb_build_object(
    'ok', true, 
    'matricula', v_matricula_numero, 
    'aluno_id', v_aluno_id
  );
END;
$$;

COMMIT;
