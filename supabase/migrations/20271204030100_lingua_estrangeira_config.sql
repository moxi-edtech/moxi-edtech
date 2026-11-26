-- Candidate migration. Validate on PostgreSQL 17 before versioning and applying.
-- One school-level setting in the existing pedagogical configuration SSOT.
-- TRUNCATE is not covered by RLS. API roles never need table-wide deletion.
REVOKE TRUNCATE ON TABLE public.configuracoes_pedagogicas FROM PUBLIC, anon, authenticated;

ALTER TABLE public.configuracoes_pedagogicas
  ADD COLUMN IF NOT EXISTS idioma_lingua_estrangeira text,
  ADD COLUMN IF NOT EXISTS idioma_lingua_estrangeira_outro text;

ALTER TABLE public.configuracoes_pedagogicas
  ADD CONSTRAINT configuracoes_pedagogicas_idioma_le_check CHECK (
    CASE
      WHEN idioma_lingua_estrangeira IS NULL THEN idioma_lingua_estrangeira_outro IS NULL
      WHEN idioma_lingua_estrangeira IN ('en','fr','es') THEN idioma_lingua_estrangeira_outro IS NULL
      WHEN idioma_lingua_estrangeira='other' THEN
        idioma_lingua_estrangeira_outro IS NOT NULL
        AND char_length(idioma_lingua_estrangeira_outro) BETWEEN 2 AND 80
        AND idioma_lingua_estrangeira_outro=btrim(idioma_lingua_estrangeira_outro)
        AND idioma_lingua_estrangeira_outro !~ '[[:cntrl:]]'
      ELSE false
    END
  );

CREATE OR REPLACE FUNCTION public.klasse_lingua_estrangeira_config_v1(
  p_escola_id uuid,
  p_write boolean DEFAULT false,
  p_idioma text DEFAULT NULL,
  p_outro text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_idioma text;
  v_outro text;
  v_before jsonb;
BEGIN
  -- Do not rely on cached application authorization or a global 'admin' profile.
  IF v_actor IS NULL OR p_escola_id IS NULL
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.user_id=v_actor AND p.deleted_at IS NULL
     )
     OR NOT (
       EXISTS (
         SELECT 1 FROM public.profiles p WHERE p.user_id=v_actor AND p.deleted_at IS NULL
           AND p.role::text IN ('super_admin','global_admin')
       )
       OR EXISTS (
         SELECT 1 FROM public.escola_users eu
         WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
           AND coalesce(eu.papel,eu.role) IN ('admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor')
       )
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_write IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  IF p_write THEN
    IF p_idioma IS NULL OR p_idioma NOT IN ('en','fr','es','other')
       OR (p_idioma='other' AND (p_outro IS NULL OR char_length(btrim(p_outro)) NOT BETWEEN 2 AND 80 OR p_outro ~ '[[:cntrl:]]'))
       OR (p_idioma<>'other' AND p_outro IS NOT NULL)
    THEN RAISE EXCEPTION 'INVALID_LANGUAGE' USING ERRCODE='22023'; END IF;
    -- Serialize per tenant; do not overwrite evaluation or progression policies.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foreign_language:'||p_escola_id::text,0));
    SELECT jsonb_build_object('idioma',c.idioma_lingua_estrangeira,'outro',c.idioma_lingua_estrangeira_outro)
      INTO v_before FROM public.configuracoes_pedagogicas c WHERE c.escola_id=p_escola_id;
    INSERT INTO public.configuracoes_pedagogicas(escola_id,idioma_lingua_estrangeira,idioma_lingua_estrangeira_outro,updated_at,updated_by)
      VALUES(p_escola_id,p_idioma,CASE WHEN p_idioma='other' THEN btrim(p_outro) ELSE NULL END,now(),v_actor)
      ON CONFLICT(escola_id) DO UPDATE
        SET idioma_lingua_estrangeira=EXCLUDED.idioma_lingua_estrangeira,
            idioma_lingua_estrangeira_outro=EXCLUDED.idioma_lingua_estrangeira_outro,
            updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;
    INSERT INTO public.audit_logs(escola_id,user_id,actor_id,portal,action,entity,entity_id,"before","after",acao,tabela,registro_id)
    VALUES(p_escola_id,v_actor,v_actor,'admin_escola','lingua_estrangeira_configurada','configuracoes_pedagogicas',p_escola_id::text,
      coalesce(v_before,jsonb_build_object('idioma',NULL,'outro',NULL)),
      jsonb_build_object('idioma',p_idioma,'outro',CASE WHEN p_idioma='other' THEN btrim(p_outro) ELSE NULL END),
      'lingua_estrangeira_configurada','configuracoes_pedagogicas',p_escola_id::text);
  END IF;
  SELECT c.idioma_lingua_estrangeira,c.idioma_lingua_estrangeira_outro INTO v_idioma,v_outro
    FROM public.configuracoes_pedagogicas c WHERE c.escola_id=p_escola_id;
  RETURN jsonb_build_object('idioma',v_idioma,'outro',v_outro);
END;
$$;
REVOKE ALL ON FUNCTION public.klasse_lingua_estrangeira_config_v1(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_lingua_estrangeira_config_v1(uuid,boolean,text,text) TO authenticated;
