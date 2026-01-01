BEGIN;

-- =============================================================================
-- MIGRATION: Criar função `get_import_summary`
-- OBJETIVO:  Fornecer um endpoint de dados consolidado para obter todos os
--            cursos e turmas que foram criados durante uma importação específica.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_import_summary(p_import_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cursos json;
  v_turmas json;
BEGIN
  -- Coleta todos os cursos criados nesta importação
  SELECT json_agg(c.*)
  INTO v_cursos
  FROM public.cursos c
  WHERE c.import_id = p_import_id;

  -- Coleta todas as turmas criadas nesta importação
  -- Adiciona informações úteis de tabelas relacionadas (cursos, classes)
  SELECT json_agg(t_agg)
  INTO v_turmas
  FROM (
    SELECT 
      t.*,
      c.nome as curso_nome,
      c.status_aprovacao as curso_status,
      cl.nome as classe_nome
    FROM public.turmas t
    LEFT JOIN public.cursos c ON t.curso_id = c.id
    LEFT JOIN public.classes cl ON t.classe_id = cl.id
    WHERE t.import_id = p_import_id
  ) t_agg;

  -- Retorna um objeto JSON com as duas listas
  RETURN json_build_object(
    'cursos', COALESCE(v_cursos, '[]'::json),
    'turmas', COALESCE(v_turmas, '[]'::json)
  );
END;
$$;

COMMIT;
