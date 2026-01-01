
CREATE OR REPLACE FUNCTION public.get_staging_alunos_summary(p_import_id uuid, p_escola_id uuid)
RETURNS TABLE(turma_codigo text, ano_letivo integer, total_alunos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      sa.turma_codigo,
      sa.ano_letivo,
      count(sa.id)::bigint as total_alunos
    FROM
      public.staging_alunos sa
    WHERE
      sa.import_id = p_import_id
      AND sa.escola_id = p_escola_id
      AND sa.turma_codigo IS NOT NULL
    GROUP BY
      sa.turma_codigo,
      sa.ano_letivo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staging_alunos_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staging_alunos_summary(uuid, uuid) TO service_role;
