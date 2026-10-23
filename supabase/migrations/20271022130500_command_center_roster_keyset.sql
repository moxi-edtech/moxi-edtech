-- Command Center: pesquisa de alunos, exclusivamente em leitura e SECURITY INVOKER.
-- Nunca aplicar em produção sem homologação da matriz de autorização/RLS.
-- Não altera policies, permissões existentes nem o contrato académico.
CREATE INDEX IF NOT EXISTS ix_cc_roster_school_turma_year_active
  ON public.matriculas (escola_id, turma_id, ano_letivo, aluno_id)
  WHERE ativo IS TRUE;

CREATE INDEX IF NOT EXISTS ix_cc_roster_turmas_school_classe_year
  ON public.turmas (escola_id, classe_id, ano_letivo_id, id);

CREATE OR REPLACE FUNCTION public.command_center_roster_keyset(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_turma_id uuid DEFAULT NULL,
  p_classe_id uuid DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_cursor_name text DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_polo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  aluno_id uuid,
  nome text,
  numero_processo text,
  turma_id uuid,
  turma_nome text,
  numero_chamada integer,
  total_filtrado bigint,
  cursor_name text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_query text := public.normalize_search_text(p_query);
  v_tsquery text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access_to_escola_fast(p_escola_id)
     OR NOT (
       public.check_super_admin_role()
       OR EXISTS (
         SELECT 1 FROM public.escola_users eu
         WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
           AND (lower(coalesce(eu.papel, '')) = ANY(ARRAY[
                'admin','admin_escola','staff_admin','diretor',
                'secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro'])
             OR lower(coalesce(eu.role, '')) = ANY(ARRAY[
                'admin','admin_escola','staff_admin','diretor',
                'secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro']))
       )
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Modelo actual não comprova escopo canónico de polo em matriculas:
  -- rejeitar em vez de devolver alunos de outros polos.
  IF p_polo_id IS NOT NULL THEN
    RAISE EXCEPTION 'polo_scope_unavailable' USING ERRCODE = '42501';
  END IF;
  IF (p_turma_id IS NULL) = (p_classe_id IS NULL)
     OR p_ano_letivo IS NULL
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 50
     OR (p_cursor_name IS NULL) <> (p_cursor_id IS NULL)
     OR length(coalesce(p_query, '')) > 90
     OR (p_query IS NOT NULL AND btrim(p_query) <> '' AND length(v_query) < 2)
  THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  IF v_query <> '' THEN
    SELECT string_agg(token || ':*', ' & ')
      INTO v_tsquery
      FROM unnest(regexp_split_to_array(v_query, '\s+')) AS token
      WHERE token <> '';
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT
      a.id AS student_id,
      coalesce(nullif(a.nome_completo, ''), nullif(a.nome, ''), 'Aluno') AS student_name,
      a.numero_processo AS student_number,
      m.turma_id AS class_group_id,
      t.nome AS class_group_name,
      m.numero_chamada AS roll_number,
      public.normalize_search_text(coalesce(nullif(a.nome_completo, ''), a.nome, 'Aluno')) AS sort_name,
      row_number() OVER (PARTITION BY a.id ORDER BY m.id DESC) AS rn
    FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id AND a.escola_id = p_escola_id AND a.deleted_at IS NULL
    JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = p_escola_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo = p_ano_letivo
      AND m.status = 'ativo' AND m.ativo IS TRUE
      AND (p_turma_id IS NULL OR m.turma_id = p_turma_id)
      AND (p_classe_id IS NULL OR t.classe_id = p_classe_id)
      AND (v_tsquery IS NULL OR to_tsvector('simple',
        public.normalize_search_text(a.nome_completo, a.nome, a.numero_processo)
      ) @@ to_tsquery('simple', v_tsquery))
  ), deduplicated AS (
    SELECT * FROM roster WHERE rn = 1
  ), counted AS (
    SELECT d.*, count(*) OVER () AS filtered_count FROM deduplicated d
  )
  SELECT c.student_id, c.student_name, c.student_number,
         c.class_group_id, c.class_group_name, c.roll_number,
         c.filtered_count, c.sort_name
  FROM counted c
  WHERE p_cursor_name IS NULL OR (c.sort_name, c.student_id) > (p_cursor_name, p_cursor_id)
  ORDER BY c.sort_name ASC, c.student_id ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.command_center_roster_keyset(
  uuid, integer, uuid, uuid, text, text, uuid, integer, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center_roster_keyset(
  uuid, integer, uuid, uuid, text, text, uuid, integer, uuid
) TO authenticated;
