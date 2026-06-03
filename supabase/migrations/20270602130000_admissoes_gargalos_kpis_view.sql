BEGIN;

-- 1. Adicionar coluna para rastrear último reenvio no portal para facilitar contagem
ALTER TABLE public.candidaturas ADD COLUMN IF NOT EXISTS portal_reenvio_at timestamp with time zone;

-- 2. Atualizar o RPC de reenvio para marcar a data
-- (O arquivo da migração original ainda não foi commitado, então vou criar uma nova migração que sobrescreve a função)
CREATE OR REPLACE FUNCTION public.admissao_reupload_documento_pendente(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_document_id text,
  p_document_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cand public.candidaturas%ROWTYPE;
  v_document_id text := nullif(btrim(coalesce(p_document_id, '')), '');
  v_document_path text := nullif(btrim(coalesce(p_document_path, '')), '');
  v_pendencias jsonb := '[]'::jsonb;
  v_updated_pendencias jsonb := '[]'::jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_new_status text;
BEGIN
  IF p_escola_id IS NULL OR p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'Escola e candidatura são obrigatórias.';
  END IF;

  IF v_document_id IS NULL OR v_document_id !~ '^[A-Za-z0-9_-]{1,120}$' THEN
    RAISE EXCEPTION 'Documento inválido.';
  END IF;

  IF v_document_path IS NULL
    OR position('..' IN v_document_path) > 0
    OR left(v_document_path, 1) = '/'
    OR position(chr(92) IN v_document_path) > 0
    OR v_document_path NOT LIKE (p_escola_id::text || '/' || p_candidatura_id::text || '/%')
  THEN
    RAISE EXCEPTION 'Caminho do documento inválido.';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = p_escola_id
  FOR UPDATE;

  IF v_cand.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF lower(coalesce(v_cand.status, '')) <> 'pendente' THEN
    RAISE EXCEPTION 'Documento só pode ser reenviado para candidatura pendente.';
  END IF;

  IF jsonb_typeof(coalesce(v_cand.dados_candidato, '{}'::jsonb)) = 'object' THEN
    v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  END IF;

  IF jsonb_typeof(v_dados->'pendencias') = 'array' THEN
    v_pendencias := v_dados->'pendencias';
  END IF;

  IF jsonb_typeof(v_dados->'documentos') IS DISTINCT FROM 'object' THEN
    v_dados := jsonb_set(v_dados, '{documentos}', '{}'::jsonb, true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_pendencias) AS item(value)
    WHERE CASE jsonb_typeof(item.value)
      WHEN 'string' THEN trim(both '"' FROM item.value::text)
      WHEN 'object' THEN item.value->>'id'
      ELSE NULL
    END = v_document_id
  ) THEN
    RAISE EXCEPTION 'Documento não está pendente de correção.';
  END IF;

  SELECT coalesce(jsonb_agg(item.value), '[]'::jsonb)
  INTO v_updated_pendencias
  FROM jsonb_array_elements(v_pendencias) AS item(value)
  WHERE CASE jsonb_typeof(item.value)
    WHEN 'string' THEN trim(both '"' FROM item.value::text)
    WHEN 'object' THEN item.value->>'id'
    ELSE NULL
  END IS DISTINCT FROM v_document_id;

  v_dados := jsonb_set(
    v_dados,
    ARRAY['documentos', v_document_id],
    to_jsonb(v_document_path),
    true
  );
  v_dados := jsonb_set(v_dados, '{pendencias}', v_updated_pendencias, true);

  v_new_status :=
    CASE
      WHEN jsonb_array_length(v_updated_pendencias) = 0 THEN 'submetida'
      ELSE 'pendente'
    END;

  UPDATE public.candidaturas
  SET
    dados_candidato = v_dados,
    status = v_new_status,
    portal_reenvio_at = now(),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = p_escola_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_new_status,
    'Reenvio de documento pendente via portal público',
    jsonb_build_object(
      'source', 'PORTAL_VAULT',
      'document_id', v_document_id,
      'document_path', v_document_path,
      'pendencias_restantes', jsonb_array_length(v_updated_pendencias)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_new_status,
    'document_id', v_document_id,
    'pendencias_restantes', jsonb_array_length(v_updated_pendencias)
  );
END;
$$;

-- 3. Atualizar a Materialized View para incluir os novos contadores
DROP MATERIALIZED VIEW IF EXISTS internal.mv_admissoes_counts_por_status CASCADE;

CREATE MATERIALIZED VIEW internal.mv_admissoes_counts_por_status AS
 WITH counts AS (
         SELECT c.escola_id,
            (count(*) FILTER (WHERE (c.status = ANY (ARRAY['submetida'::text, 'pendente'::text]))))::integer AS submetida_total,
            (count(*) FILTER (WHERE (c.status = 'em_analise'::text)))::integer AS em_analise_total,
            (count(*) FILTER (WHERE (c.status = ANY (ARRAY['aprovada'::text, 'aguardando_pagamento'::text]))))::integer AS aprovada_total,
            (count(*) FILTER (WHERE ((c.status = ANY (ARRAY['matriculado'::text, 'convertida'::text])) AND (c.matriculado_em >= (now() - '7 days'::interval)))))::integer AS matriculado_7d_total,
            -- Novos contadores de Gargalo
            (count(*) FILTER (WHERE (c.status = 'aguardando_pagamento' AND c.expires_at > now() AND c.expires_at <= (now() + interval '24 hours'))))::integer AS expirando_24h_total,
            (count(*) FILTER (WHERE (c.portal_reenvio_at >= (now() - interval '48 hours'))))::integer AS reenviados_48h_total
           FROM public.candidaturas c
          GROUP BY c.escola_id
        )
 SELECT escola_id,
    submetida_total,
    em_analise_total,
    aprovada_total,
    matriculado_7d_total,
    expirando_24h_total,
    reenviados_48h_total
   FROM counts
  WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_admissoes_counts_por_status ON internal.mv_admissoes_counts_por_status (escola_id);

REFRESH MATERIALIZED VIEW internal.mv_admissoes_counts_por_status;

-- 4. Recriar a View Pública
CREATE OR REPLACE VIEW public.vw_admissoes_counts_por_status WITH (security_invoker='true') AS
 SELECT m.escola_id,
    m.submetida_total,
    m.em_analise_total,
    m.aprovada_total,
    m.matriculado_7d_total,
    m.expirando_24h_total,
    m.reenviados_48h_total
   FROM internal.mv_admissoes_counts_por_status m
  WHERE (m.escola_id IN ( SELECT eu.escola_id
           FROM public.escola_users eu
          WHERE (eu.user_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.refresh_mv_admissoes_counts_por_status()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admissoes_counts_por_status;
$$;

REVOKE ALL ON FUNCTION public.refresh_mv_admissoes_counts_por_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_mv_admissoes_counts_por_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_admissoes_counts_por_status() TO service_role;

GRANT SELECT ON internal.mv_admissoes_counts_por_status TO authenticated, service_role;
GRANT SELECT ON public.vw_admissoes_counts_por_status TO authenticated, service_role;

COMMIT;
