-- Staging area for academic rollover imports.
-- Stores validated input before any official grade or enrolment mutation.

CREATE TABLE IF NOT EXISTS public.virada_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_origem integer NOT NULL,
  origem text NOT NULL CHECK (origem IN ('PLANILHA', 'MANUAL', 'API')),
  status text NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO', 'VALIDADO', 'APROVADO', 'APLICADO', 'REJEITADO')),
  idempotency_key text NOT NULL,
  checksum text NOT NULL,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  aplicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT virada_importacoes_idempotency_unique UNIQUE (escola_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.virada_importacao_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.virada_importacoes(id) ON DELETE CASCADE,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  linha integer NOT NULL CHECK (linha >= 2),
  status text NOT NULL
    CHECK (status IN ('VALIDA', 'REJEITADA', 'DUPLICADA', 'SEM_CORRESPONDENCIA', 'APLICADA')),
  chave text,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  erros text[] NOT NULL DEFAULT '{}',
  matricula_id uuid REFERENCES public.matriculas(id),
  aluno_id uuid REFERENCES public.alunos(id),
  aplicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT virada_importacao_linhas_numero_unique UNIQUE (importacao_id, linha)
);

CREATE INDEX IF NOT EXISTS idx_virada_importacoes_escola_status
  ON public.virada_importacoes (escola_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_virada_importacao_linhas_importacao_status
  ON public.virada_importacao_linhas (importacao_id, status, linha);

ALTER TABLE public.virada_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virada_importacao_linhas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.virada_importacoes FROM anon, authenticated;
REVOKE ALL ON public.virada_importacao_linhas FROM anon, authenticated;
GRANT SELECT, INSERT ON public.virada_importacoes TO authenticated;
GRANT SELECT, INSERT ON public.virada_importacao_linhas TO authenticated;

DROP POLICY IF EXISTS virada_importacoes_tenant_select ON public.virada_importacoes;
CREATE POLICY virada_importacoes_tenant_select
ON public.virada_importacoes FOR SELECT TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin', 'diretor', 'super_admin']::text[]
  )
);

DROP POLICY IF EXISTS virada_importacoes_tenant_insert ON public.virada_importacoes;
CREATE POLICY virada_importacoes_tenant_insert
ON public.virada_importacoes FOR INSERT TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin', 'diretor', 'super_admin']::text[]
  )
  AND criado_por = (SELECT auth.uid())
  AND status IN ('RASCUNHO', 'VALIDADO')
  AND aprovado_por IS NULL
  AND aprovado_em IS NULL
  AND aplicado_em IS NULL
);

DROP POLICY IF EXISTS virada_importacao_linhas_tenant_select ON public.virada_importacao_linhas;
CREATE POLICY virada_importacao_linhas_tenant_select
ON public.virada_importacao_linhas FOR SELECT TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin', 'diretor', 'super_admin']::text[]
  )
);

DROP POLICY IF EXISTS virada_importacao_linhas_tenant_insert ON public.virada_importacao_linhas;
CREATE POLICY virada_importacao_linhas_tenant_insert
ON public.virada_importacao_linhas FOR INSERT TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(
    escola_id,
    ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin', 'diretor', 'super_admin']::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM public.virada_importacoes vi
    WHERE vi.id = importacao_id
      AND vi.escola_id = virada_importacao_linhas.escola_id
      AND vi.criado_por = (SELECT auth.uid())
  )
);

DROP TRIGGER IF EXISTS trg_set_updated_at_virada_importacoes ON public.virada_importacoes;
CREATE TRIGGER trg_set_updated_at_virada_importacoes
BEFORE UPDATE ON public.virada_importacoes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.aprovar_virada_importacao(p_importacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_importacao public.virada_importacoes%ROWTYPE;
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT * INTO v_importacao
  FROM public.virada_importacoes
  WHERE id = p_importacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: lote não encontrado';
  END IF;

  IF v_importacao.escola_id <> public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: lote fora do tenant atual';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_importacao.escola_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'diretor', 'super_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'AUTH: perfil sem permissão para aprovar resultados';
  END IF;

  IF v_importacao.status = 'APROVADO' THEN
    RETURN jsonb_build_object('id', v_importacao.id, 'status', v_importacao.status, 'reused', true);
  END IF;

  IF v_importacao.status <> 'VALIDADO' THEN
    RAISE EXCEPTION 'DATA: apenas lotes VALIDADOS podem ser aprovados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.virada_importacao_linhas vil
    WHERE vil.importacao_id = v_importacao.id
      AND vil.status <> 'VALIDA'
  ) THEN
    RAISE EXCEPTION 'DATA: lote contém linhas não válidas';
  END IF;

  UPDATE public.virada_importacoes
  SET status = 'APROVADO', aprovado_por = v_user_id, aprovado_em = now()
  WHERE id = v_importacao.id;

  RETURN jsonb_build_object('id', v_importacao.id, 'status', 'APROVADO', 'reused', false);
END
$function$;

REVOKE ALL ON FUNCTION public.aprovar_virada_importacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_virada_importacao(uuid) TO authenticated;
