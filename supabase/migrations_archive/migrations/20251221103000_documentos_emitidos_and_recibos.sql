-- Documentos emitidos + RPCs de emissão/validação (idempotente)
BEGIN;

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum dos tipos de documento
DO $$ BEGIN
  CREATE TYPE public.tipo_documento AS ENUM ('recibo', 'declaracao', 'certificado', 'historico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela append-only para documentos emitidos
CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  mensalidade_id uuid NULL REFERENCES public.mensalidades(id) ON DELETE SET NULL, -- apenas para recibos

  tipo public.tipo_documento NOT NULL,
  dados_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL, -- auth.uid()
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,

  CONSTRAINT chk_revoked_consistency CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

-- Idempotência e performance
CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_recibo_por_mensalidade
  ON public.documentos_emitidos (mensalidade_id)
  WHERE (tipo = 'recibo' AND mensalidade_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_docs_public_id ON public.documentos_emitidos (public_id);
CREATE INDEX IF NOT EXISTS idx_docs_escola_created ON public.documentos_emitidos (escola_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_aluno_created ON public.documentos_emitidos (aluno_id, created_at DESC);

ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

-- Política: SELECT apenas para membros da escola (ou super_admin)
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documentos_emitidos' AND policyname = 'docs_select_school'
  ) THEN
    CREATE POLICY "docs_select_school"
    ON public.documentos_emitidos
    FOR SELECT
    TO authenticated
    USING (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND (p.escola_id = documentos_emitidos.escola_id OR p.current_escola_id = documentos_emitidos.escola_id)
      )
    );
  END IF;
END
$policy$;

-- Política: INSERT apenas para membros da escola (ou super_admin)
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documentos_emitidos' AND policyname = 'docs_insert_school'
  ) THEN
    CREATE POLICY "docs_insert_school"
    ON public.documentos_emitidos
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND (p.escola_id = documentos_emitidos.escola_id OR p.current_escola_id = documentos_emitidos.escola_id)
      )
    );
  END IF;
END
$policy$;

-- RPC: emitir recibo (idempotente e segura)
CREATE OR REPLACE FUNCTION public.emitir_recibo(p_mensalidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_m public.mensalidades%ROWTYPE;
  v_doc record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT *
    INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  -- User deve pertencer à escola da mensalidade
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  -- Plano precisa liberar o recurso
  IF NOT public.escola_has_feature(v_m.escola_id, 'fin_recibo_pdf') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Plano não inclui Recibo PDF');
  END IF;

  -- Apenas mensalidades pagas
  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  -- Idempotência: retorna recibo existente
  SELECT id, public_id, created_at
    INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo'
    AND mensalidade_id = p_mensalidade_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'doc_id', v_doc.id,
      'public_id', v_doc.public_id,
      'emitido_em', v_doc.created_at
    );
  END IF;

  -- Cria snapshot do recibo
  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, tipo, dados_snapshot, created_by
  ) VALUES (
    v_m.escola_id,
    v_m.aluno_id,
    v_m.id,
    'recibo',
    jsonb_build_object(
      'mensalidade_id', v_m.id,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento
    ),
    v_user_id
  )
  RETURNING id, public_id, created_at INTO v_doc;

  RETURN jsonb_build_object(
    'ok', true,
    'doc_id', v_doc.id,
    'public_id', v_doc.public_id,
    'emitido_em', v_doc.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_recibo(uuid) TO authenticated;

-- RPC: verificar documento público via public_id
CREATE OR REPLACE FUNCTION public.verificar_documento_publico(p_public_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_escola_nome text;
  v_aluno_nome text;
BEGIN
  SELECT de.public_id, de.tipo, de.created_at, de.revoked_at, de.escola_id, de.dados_snapshot, a.nome_completo
    INTO v_doc
  FROM public.documentos_emitidos de
  JOIN public.alunos a ON a.id = de.aluno_id
  WHERE de.public_id = p_public_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'mensagem', 'Documento não encontrado');
  END IF;

  SELECT nome INTO v_escola_nome
  FROM public.escolas
  WHERE id = v_doc.escola_id;

  v_aluno_nome := coalesce(v_doc.nome_completo, '');

  RETURN jsonb_build_object(
    'valido', (v_doc.revoked_at IS NULL),
    'status', CASE WHEN v_doc.revoked_at IS NULL THEN 'VALIDO' ELSE 'REVOGADO' END,
    'tipo', v_doc.tipo,
    'emitido_em', v_doc.created_at,
    'escola', v_escola_nome,
    'aluno', regexp_replace(v_aluno_nome, '(^.).*( .*$)', '\\1***\\2'),
    'referencia', v_doc.dados_snapshot->>'referencia',
    'valor_pago', v_doc.dados_snapshot->>'valor_pago'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_documento_publico(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_documento_publico(uuid) TO authenticated;

COMMIT;
