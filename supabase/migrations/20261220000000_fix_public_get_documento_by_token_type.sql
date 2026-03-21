BEGIN;

CREATE OR REPLACE FUNCTION public.public_get_documento_by_token(
  p_public_id uuid,
  p_hash text
)
RETURNS TABLE(
  id uuid,
  escola_id uuid,
  tipo text,
  emitted_at timestamp with time zone,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_public_id IS NULL THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 16 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  RETURN QUERY
  SELECT
    de.id,
    de.escola_id,
    de.tipo::text,
    de.created_at AS emitted_at,
    CASE
      WHEN de.dados_snapshot ? 'escola_nome' THEN de.dados_snapshot
      ELSE jsonb_set(de.dados_snapshot, '{escola_nome}', to_jsonb(e.nome), true)
    END AS payload
  FROM public.documentos_emitidos de
  LEFT JOIN public.escolas e ON e.id = de.escola_id
  WHERE de.public_id = p_public_id
    AND de.hash_validacao = p_hash
  LIMIT 1;
END;
$$;

COMMIT;
