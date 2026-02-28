CREATE TABLE IF NOT EXISTS public.escola_notas_internas (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  nota text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_escola_notas_internas_escola
  ON public.escola_notas_internas (escola_id);

ALTER TABLE public.escola_notas_internas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escola_notas_super_admin_select ON public.escola_notas_internas;
CREATE POLICY escola_notas_super_admin_select
  ON public.escola_notas_internas
  FOR SELECT
  TO authenticated
  USING (public.check_super_admin_role());

DROP POLICY IF EXISTS escola_notas_super_admin_insert ON public.escola_notas_internas;
CREATE POLICY escola_notas_super_admin_insert
  ON public.escola_notas_internas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.check_super_admin_role());

DROP POLICY IF EXISTS escola_notas_super_admin_update ON public.escola_notas_internas;
CREATE POLICY escola_notas_super_admin_update
  ON public.escola_notas_internas
  FOR UPDATE
  TO authenticated
  USING (public.check_super_admin_role())
  WITH CHECK (public.check_super_admin_role());

DROP TRIGGER IF EXISTS trg_escola_notas_internas_updated ON public.escola_notas_internas;
CREATE TRIGGER trg_escola_notas_internas_updated
  BEFORE UPDATE ON public.escola_notas_internas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_get_storage_usage(
  p_limit integer DEFAULT 50,
  p_bucket_ids text[] DEFAULT NULL
)
RETURNS TABLE(
  escola_id uuid,
  escola_nome text,
  total_bytes bigint,
  total_documentos bigint,
  last_30d_bytes bigint,
  projected_30d_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  WITH raw AS (
    SELECT
      (storage.foldername(o.name))[1] AS escola_folder,
      o.created_at,
      COALESCE(
        NULLIF(o.metadata->>'size', '')::bigint,
        NULLIF(o.metadata->>'content_length', '')::bigint,
        0
      ) AS bytes
    FROM storage.objects o
    WHERE (p_bucket_ids IS NULL OR o.bucket_id = ANY(p_bucket_ids))
  ),
  filtered AS (
    SELECT
      escola_folder::uuid AS escola_id,
      created_at,
      bytes
    FROM raw
    WHERE escola_folder ~* '^[0-9a-f\-]{36}$'
  ),
  aggregated AS (
    SELECT
      f.escola_id,
      SUM(f.bytes)::bigint AS total_bytes,
      COUNT(*)::bigint AS total_documentos,
      SUM(CASE WHEN f.created_at >= now() - interval '30 days' THEN f.bytes ELSE 0 END)::bigint AS last_30d_bytes
    FROM filtered f
    GROUP BY f.escola_id
  )
  SELECT
    a.escola_id,
    e.nome,
    a.total_bytes,
    a.total_documentos,
    a.last_30d_bytes,
    (a.total_bytes + a.last_30d_bytes)::bigint AS projected_30d_bytes
  FROM aggregated a
  JOIN public.escolas e ON e.id = a.escola_id
  ORDER BY a.total_bytes DESC
  LIMIT COALESCE(p_limit, 50);
END;
$$;
