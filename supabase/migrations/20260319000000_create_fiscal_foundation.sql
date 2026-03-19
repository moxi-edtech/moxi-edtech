BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nif text NOT NULL,
  endereco text,
  certificado_agt_numero text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'retired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_empresas_nif_digits_chk CHECK (nif ~ '^[0-9]{9,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_empresas_nif
  ON public.fiscal_empresas (nif);

CREATE TABLE IF NOT EXISTS public.fiscal_empresa_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'auditor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_empresa_users_user
  ON public.fiscal_empresa_users (user_id, empresa_id);

CREATE TABLE IF NOT EXISTS public.fiscal_escola_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_escola_bindings_date_chk CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_escola_bindings_range
  ON public.fiscal_escola_bindings (escola_id, empresa_id, effective_from);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_escola_bindings_primary_active
  ON public.fiscal_escola_bindings (escola_id)
  WHERE is_primary = true AND effective_to IS NULL;

CREATE TABLE IF NOT EXISTS public.fiscal_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  prefixo text NOT NULL,
  origem_documento text NOT NULL CHECK (origem_documento IN ('interno', 'manual_recuperado', 'integrado', 'formacao', 'contingencia')),
  ultimo_numero bigint NOT NULL DEFAULT 0,
  ativa boolean NOT NULL DEFAULT true,
  descontinuada_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo_documento, prefixo, origem_documento),
  CONSTRAINT fiscal_series_numero_chk CHECK (ultimo_numero >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_series_empresa_tipo
  ON public.fiscal_series (empresa_id, tipo_documento, ativa);

CREATE TABLE IF NOT EXISTS public.fiscal_chaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  key_version integer NOT NULL,
  algorithm text NOT NULL DEFAULT 'RSA' CHECK (algorithm = 'RSA'),
  public_key_pem text NOT NULL,
  private_key_ref text,
  key_fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'retired')),
  activated_at timestamptz,
  retired_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, key_version),
  CONSTRAINT fiscal_chaves_version_chk CHECK (key_version > 0),
  CONSTRAINT fiscal_chaves_retired_chk CHECK (retired_at IS NULL OR status = 'retired')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_chaves_active_per_empresa
  ON public.fiscal_chaves (empresa_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.fiscal_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  serie_id uuid NOT NULL REFERENCES public.fiscal_series(id) ON DELETE RESTRICT,
  tipo_documento text NOT NULL,
  numero bigint NOT NULL,
  numero_formatado text NOT NULL,
  cliente_id uuid,
  cliente_nome text NOT NULL,
  cliente_nif text,
  invoice_date date NOT NULL,
  system_entry timestamptz NOT NULL DEFAULT now(),
  moeda text NOT NULL DEFAULT 'AOA',
  taxa_cambio_aoa numeric(18,8),
  total_bruto_aoa numeric(18,4) NOT NULL,
  total_impostos_aoa numeric(18,4) NOT NULL,
  total_liquido_aoa numeric(18,4) NOT NULL,
  hash_anterior text,
  assinatura_base64 text NOT NULL,
  hash_control text NOT NULL,
  canonical_string text,
  key_version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('emitido', 'rectificado', 'anulado')),
  documento_origem_id uuid,
  rectifica_documento_id uuid REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path text,
  xml_storage_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (serie_id, numero),
  UNIQUE (empresa_id, numero_formatado),
  CONSTRAINT fiscal_documentos_totals_chk CHECK (
    total_bruto_aoa >= 0
    AND total_impostos_aoa >= 0
    AND total_liquido_aoa >= 0
  ),
  CONSTRAINT fiscal_documentos_moeda_chk CHECK (char_length(moeda) = 3),
  CONSTRAINT fiscal_documentos_cliente_nif_chk CHECK (cliente_nif IS NULL OR cliente_nif ~ '^[0-9]{9,20}$'),
  CONSTRAINT fiscal_documentos_fk_key_version
    FOREIGN KEY (empresa_id, key_version)
    REFERENCES public.fiscal_chaves (empresa_id, key_version)
    ON DELETE RESTRICT
);

ALTER TABLE public.fiscal_documentos
  ADD CONSTRAINT fiscal_documentos_documento_origem_fk
  FOREIGN KEY (documento_origem_id)
  REFERENCES public.fiscal_documentos(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_empresa_created
  ON public.fiscal_documentos (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_empresa_status
  ON public.fiscal_documentos (empresa_id, status, invoice_date DESC);

CREATE TABLE IF NOT EXISTS public.fiscal_documento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id) ON DELETE CASCADE,
  linha_no integer NOT NULL,
  descricao text NOT NULL,
  quantidade numeric(18,4) NOT NULL,
  preco_unit numeric(18,4) NOT NULL,
  taxa_iva numeric(5,2) NOT NULL,
  total_liquido_aoa numeric(18,4) NOT NULL,
  total_impostos_aoa numeric(18,4) NOT NULL,
  total_bruto_aoa numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, linha_no),
  CONSTRAINT fiscal_documento_itens_line_chk CHECK (linha_no > 0),
  CONSTRAINT fiscal_documento_itens_values_chk CHECK (
    quantidade > 0
    AND preco_unit >= 0
    AND taxa_iva >= 0
    AND total_liquido_aoa >= 0
    AND total_impostos_aoa >= 0
    AND total_bruto_aoa >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documento_itens_documento
  ON public.fiscal_documento_itens (documento_id, linha_no);

CREATE TABLE IF NOT EXISTS public.fiscal_documentos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL CHECK (tipo_evento IN (
    'EMITIDO',
    'RECTIFICADO',
    'ANULADO',
    'PDF_GERADO',
    'REIMPRESSO',
    'SAFT_EXPORTADO',
    'SUBMETIDO',
    'CHAVE_ACTIVADA'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_eventos_documento
  ON public.fiscal_documentos_eventos (documento_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fiscal_saft_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  arquivo_storage_path text NOT NULL,
  checksum_sha256 text NOT NULL,
  xsd_version text NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'validated', 'failed', 'submitted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, periodo_inicio, periodo_fim),
  CONSTRAINT fiscal_saft_exports_period_chk CHECK (periodo_fim >= periodo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_saft_exports_empresa_periodo
  ON public.fiscal_saft_exports (empresa_id, periodo_inicio DESC, periodo_fim DESC);

CREATE OR REPLACE FUNCTION public.fiscal_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_empresas_updated_at ON public.fiscal_empresas;
CREATE TRIGGER trg_fiscal_empresas_updated_at
BEFORE UPDATE ON public.fiscal_empresas
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fiscal_escola_bindings_updated_at ON public.fiscal_escola_bindings;
CREATE TRIGGER trg_fiscal_escola_bindings_updated_at
BEFORE UPDATE ON public.fiscal_escola_bindings
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fiscal_series_updated_at ON public.fiscal_series;
CREATE TRIGGER trg_fiscal_series_updated_at
BEFORE UPDATE ON public.fiscal_series
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fiscal_chaves_updated_at ON public.fiscal_chaves;
CREATE TRIGGER trg_fiscal_chaves_updated_at
BEFORE UPDATE ON public.fiscal_chaves
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_touch_updated_at();

CREATE OR REPLACE FUNCTION public.current_tenant_empresa_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claims jsonb := '{}'::jsonb;
  v_empresa uuid := null;
  v_uid uuid := public.safe_auth_uid();
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN others THEN
    v_claims := '{}'::jsonb;
  END;

  IF (v_claims ? 'empresa_id') THEN
    v_empresa := nullif(v_claims->>'empresa_id', '')::uuid;
    IF v_empresa IS NOT NULL THEN
      RETURN v_empresa;
    END IF;
  END IF;

  IF (v_claims ? 'app_metadata') AND ((v_claims->'app_metadata') ? 'empresa_id') THEN
    v_empresa := nullif((v_claims->'app_metadata')->>'empresa_id', '')::uuid;
    IF v_empresa IS NOT NULL THEN
      RETURN v_empresa;
    END IF;
  END IF;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT feu.empresa_id
    INTO v_empresa
  FROM public.fiscal_empresa_users feu
  WHERE feu.user_id = v_uid
  ORDER BY feu.created_at ASC
  LIMIT 1;

  RETURN v_empresa;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_empresa(
  p_empresa_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
BEGIN
  IF public.check_super_admin_role() THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL OR p_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = p_empresa_id
      AND feu.user_id = v_uid
      AND feu.role = ANY (p_roles)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
RETURNS TABLE (
  numero bigint,
  numero_formatado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_serie public.fiscal_series%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série não encontrada';
  END IF;

  IF NOT public.user_has_role_in_empresa(v_serie.empresa_id, ARRAY['owner','admin','operator']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para reservar número da série';
  END IF;

  IF NOT v_serie.ativa THEN
    RAISE EXCEPTION 'STATE: série inativa';
  END IF;

  IF v_serie.descontinuada_em IS NOT NULL THEN
    RAISE EXCEPTION 'STATE: série descontinuada';
  END IF;

  UPDATE public.fiscal_series
     SET ultimo_numero = ultimo_numero + 1,
         updated_at = now()
   WHERE id = p_serie_id
   RETURNING ultimo_numero INTO numero;

  numero_formatado := v_serie.prefixo || '-' || lpad(numero::text, 6, '0');
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_validate_document_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_serie_empresa_id uuid;
BEGIN
  SELECT empresa_id
    INTO v_serie_empresa_id
  FROM public.fiscal_series
  WHERE id = NEW.serie_id;

  IF v_serie_empresa_id IS NULL THEN
    RAISE EXCEPTION 'DATA: série fiscal inválida';
  END IF;

  IF v_serie_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'TENANT: empresa do documento divergente da empresa da série';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_validate_item_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_documento_empresa_id uuid;
BEGIN
  SELECT empresa_id
    INTO v_documento_empresa_id
  FROM public.fiscal_documentos
  WHERE id = NEW.documento_id;

  IF v_documento_empresa_id IS NULL THEN
    RAISE EXCEPTION 'DATA: documento fiscal inválido';
  END IF;

  IF v_documento_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'TENANT: empresa do item divergente da empresa do documento';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_validate_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_documento_empresa_id uuid;
BEGIN
  SELECT empresa_id
    INTO v_documento_empresa_id
  FROM public.fiscal_documentos
  WHERE id = NEW.documento_id;

  IF v_documento_empresa_id IS NULL THEN
    RAISE EXCEPTION 'DATA: documento fiscal inválido';
  END IF;

  IF v_documento_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'TENANT: empresa do evento divergente da empresa do documento';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_prevent_update_emitido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('emitido', 'rectificado', 'anulado') THEN
    RAISE EXCEPTION 'IMMUTABILITY: documento fiscal fechado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_consistency ON public.fiscal_documentos;
CREATE TRIGGER trg_fiscal_documentos_consistency
BEFORE INSERT OR UPDATE ON public.fiscal_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_document_consistency();

DROP TRIGGER IF EXISTS trg_fiscal_documentos_no_update ON public.fiscal_documentos;
CREATE TRIGGER trg_fiscal_documentos_no_update
BEFORE UPDATE ON public.fiscal_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_prevent_update_emitido();

DROP TRIGGER IF EXISTS trg_fiscal_documento_itens_consistency ON public.fiscal_documento_itens;
CREATE TRIGGER trg_fiscal_documento_itens_consistency
BEFORE INSERT OR UPDATE ON public.fiscal_documento_itens
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_item_consistency();

DROP TRIGGER IF EXISTS trg_fiscal_documentos_eventos_consistency ON public.fiscal_documentos_eventos;
CREATE TRIGGER trg_fiscal_documentos_eventos_consistency
BEFORE INSERT OR UPDATE ON public.fiscal_documentos_eventos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_event_consistency();

ALTER TABLE public.fiscal_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_empresa_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_empresa_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_escola_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_escola_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_series FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_chaves FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documento_itens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos_eventos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_saft_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_saft_exports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_empresas_select ON public.fiscal_empresas;
CREATE POLICY fiscal_empresas_select
ON public.fiscal_empresas
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_empresas.id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_empresas_mutation ON public.fiscal_empresas;
CREATE POLICY fiscal_empresas_mutation
ON public.fiscal_empresas
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_empresa_users_select ON public.fiscal_empresa_users;
CREATE POLICY fiscal_empresa_users_select
ON public.fiscal_empresa_users
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_empresa_users.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_empresa_users_mutation ON public.fiscal_empresa_users;
CREATE POLICY fiscal_empresa_users_mutation
ON public.fiscal_empresa_users
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_escola_bindings_select ON public.fiscal_escola_bindings;
CREATE POLICY fiscal_escola_bindings_select
ON public.fiscal_escola_bindings
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_escola_bindings.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_escola_bindings_mutation ON public.fiscal_escola_bindings;
CREATE POLICY fiscal_escola_bindings_mutation
ON public.fiscal_escola_bindings
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_series_select ON public.fiscal_series;
CREATE POLICY fiscal_series_select
ON public.fiscal_series
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_series.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_series_mutation ON public.fiscal_series;
CREATE POLICY fiscal_series_mutation
ON public.fiscal_series
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
);

DROP POLICY IF EXISTS fiscal_chaves_select ON public.fiscal_chaves;
CREATE POLICY fiscal_chaves_select
ON public.fiscal_chaves
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_chaves.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_chaves_mutation ON public.fiscal_chaves;
CREATE POLICY fiscal_chaves_mutation
ON public.fiscal_chaves
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_documentos_select ON public.fiscal_documentos;
CREATE POLICY fiscal_documentos_select
ON public.fiscal_documentos
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_documentos.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_documentos_insert ON public.fiscal_documentos;
CREATE POLICY fiscal_documentos_insert
ON public.fiscal_documentos
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
);

DROP POLICY IF EXISTS fiscal_documentos_update ON public.fiscal_documentos;
CREATE POLICY fiscal_documentos_update
ON public.fiscal_documentos
FOR UPDATE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_documentos_delete ON public.fiscal_documentos;
CREATE POLICY fiscal_documentos_delete
ON public.fiscal_documentos
FOR DELETE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner'])
);

DROP POLICY IF EXISTS fiscal_documento_itens_select ON public.fiscal_documento_itens;
CREATE POLICY fiscal_documento_itens_select
ON public.fiscal_documento_itens
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_documento_itens.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_documento_itens_mutation ON public.fiscal_documento_itens;
CREATE POLICY fiscal_documento_itens_mutation
ON public.fiscal_documento_itens
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
);

DROP POLICY IF EXISTS fiscal_documentos_eventos_select ON public.fiscal_documentos_eventos;
CREATE POLICY fiscal_documentos_eventos_select
ON public.fiscal_documentos_eventos
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_documentos_eventos.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_documentos_eventos_mutation ON public.fiscal_documentos_eventos;
CREATE POLICY fiscal_documentos_eventos_mutation
ON public.fiscal_documentos_eventos
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
);

DROP POLICY IF EXISTS fiscal_saft_exports_select ON public.fiscal_saft_exports;
CREATE POLICY fiscal_saft_exports_select
ON public.fiscal_saft_exports
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = fiscal_saft_exports.empresa_id
      AND feu.user_id = public.safe_auth_uid()
  )
);

DROP POLICY IF EXISTS fiscal_saft_exports_mutation ON public.fiscal_saft_exports;
CREATE POLICY fiscal_saft_exports_mutation
ON public.fiscal_saft_exports
FOR ALL
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin','operator'])
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_empresa_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_escola_bindings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_chaves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documento_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documentos_eventos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_saft_exports TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_empresa(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_reservar_numero_serie(uuid) TO authenticated;

COMMIT;
