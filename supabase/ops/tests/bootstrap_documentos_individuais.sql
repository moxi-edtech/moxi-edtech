-- Minimal, disposable PostgreSQL 17 harness for individual document settlement.
-- Run AFTER bootstrap_balcao_p0_minimal.sql and BAL-GR-003 migration/regression.
CREATE TABLE IF NOT EXISTS public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  session_id uuid,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.servicos_escola (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  valor_base numeric(12,0) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  exige_pagamento_antes_de_liberar boolean NOT NULL DEFAULT false,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  UNIQUE (escola_id,codigo)
);

CREATE TABLE IF NOT EXISTS public.servico_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  servico_escola_id uuid NOT NULL REFERENCES public.servicos_escola(id),
  status text NOT NULL DEFAULT 'pending_payment',
  servico_codigo text NOT NULL,
  servico_nome text NOT NULL,
  valor_cobrado numeric(12,0) NOT NULL DEFAULT 0,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagamento_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  servico_pedido_id uuid REFERENCES public.servico_pedidos(id),
  amount numeric(12,0) NOT NULL,
  currency text NOT NULL DEFAULT 'AOA',
  method text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  reference text,
  evidence_url text,
  settled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  mensalidade_id uuid,
  valor_pago numeric(12,2) NOT NULL,
  metodo text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'pending',
  reference text,
  evidence_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A emissão certificada exige histórico/disciplinas oficiais no mesmo ano.
-- Tabelas mínimas apenas para esta base de CI descartável.
CREATE TABLE IF NOT EXISTS public.historico_anos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  ano_letivo integer NOT NULL,
  matricula_id uuid,
  snapshot_status text
);

CREATE TABLE IF NOT EXISTS public.historico_disciplinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historico_ano_id uuid NOT NULL REFERENCES public.historico_anos(id),
  disciplina_nome text,
  nota_final numeric,
  media_final numeric
);

-- Original direct RPC is stubbed only inside the disposable CI database.
CREATE OR REPLACE FUNCTION public.emitir_documento_final(
  p_escola_id uuid, p_aluno_id uuid, p_ano_letivo integer, p_tipo_documento text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_doc public.documentos_emitidos%ROWTYPE;
  v_matricula uuid;
BEGIN
  SELECT id INTO v_matricula FROM public.matriculas
  WHERE escola_id=p_escola_id AND aluno_id=p_aluno_id
    AND session_id IN (
      SELECT id FROM public.anos_letivos
      WHERE escola_id=p_escola_id AND ano=p_ano_letivo
    )
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.documentos_emitidos(escola_id,aluno_id,tipo,dados_snapshot,created_by,hash_validacao)
  VALUES (p_escola_id,p_aluno_id,p_tipo_documento::public.tipo_documento,
    jsonb_build_object('matricula_id',v_matricula,'ano_letivo',p_ano_letivo),
    public.safe_auth_uid(),encode(public.sha256(gen_random_uuid()::text::bytea),'hex'))
  RETURNING * INTO v_doc;
  RETURN jsonb_build_object(
    'ok',true,'docId',v_doc.id,'publicId',v_doc.public_id,
    'hash',v_doc.hash_validacao,'tipo',v_doc.tipo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_documento_final(uuid,uuid,integer,text)
TO authenticated, service_role;
