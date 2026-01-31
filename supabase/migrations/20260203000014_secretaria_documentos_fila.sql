BEGIN;

-- =========================================================
-- 1) Numeração sequencial de documentos por escola
-- =========================================================

CREATE TABLE IF NOT EXISTS public.documentos_sequencia (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  ultimo_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_sequencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON public.documentos_sequencia;
CREATE POLICY tenant_select ON public.documentos_sequencia
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_write ON public.documentos_sequencia;
CREATE POLICY tenant_write ON public.documentos_sequencia
  FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_update ON public.documentos_sequencia;
CREATE POLICY tenant_update ON public.documentos_sequencia
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

ALTER TABLE public.documentos_emitidos
  ADD COLUMN IF NOT EXISTS numero_sequencial integer;

CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_emitidos_escola_numero
  ON public.documentos_emitidos (escola_id, numero_sequencial)
  WHERE numero_sequencial IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_documento_numero(p_escola_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO public.documentos_sequencia (escola_id, ultimo_numero)
  VALUES (p_escola_id, 1)
  ON CONFLICT (escola_id) DO UPDATE
    SET ultimo_numero = public.documentos_sequencia.ultimo_numero + 1,
        updated_at = now()
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_documento_numero(uuid) TO authenticated, service_role;

-- =========================================================
-- 2) Fila de atendimento (balcão)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atendimentos_balcao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  operador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_atendimento','fechado','cancelado')),
  motivo text NOT NULL,
  resolucao text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_balcao_escola_status
  ON public.atendimentos_balcao (escola_id, status, iniciado_em DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_balcao_escola_operador
  ON public.atendimentos_balcao (escola_id, operador_id, iniciado_em DESC);

ALTER TABLE public.atendimentos_balcao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON public.atendimentos_balcao;
CREATE POLICY tenant_select ON public.atendimentos_balcao
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert ON public.atendimentos_balcao;
CREATE POLICY tenant_insert ON public.atendimentos_balcao
  FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_update ON public.atendimentos_balcao;
CREATE POLICY tenant_update ON public.atendimentos_balcao
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

COMMIT;
