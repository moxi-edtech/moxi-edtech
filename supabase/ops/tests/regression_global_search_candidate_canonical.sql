-- Execute após a migração, com role autorizada. Apenas leitura; não altera dados.
-- Garante lookup por acento, separação aluno/candidato e a mesma escola/ano letivo.
BEGIN;

DO $test$
BEGIN
  IF public.unaccent('João António') <> 'Joao Antonio'
     OR public.unaccent('Joao Antonio') <> 'Joao Antonio'
     OR NOT (
       to_tsvector('simple', public.unaccent('João António'))
       @@ to_tsquery('simple', 'joao:* & antonio:*')
     )
     OR NOT (
       to_tsvector('simple', public.unaccent('Joao Antonio'))
       @@ to_tsquery('simple', 'joao:* & antonio:*')
     )
  THEN
    RAISE EXCEPTION 'Regressão: busca com e sem acento';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vw_search_alunos AS s
    JOIN public.alunos AS a ON a.id = s.id AND a.escola_id = s.escola_id
    WHERE a.deleted_at IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.matriculas AS m
      WHERE m.escola_id = a.escola_id AND m.aluno_id = a.id
        AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
    )
  ) THEN
    RAISE EXCEPTION 'Regressão: candidato sem matrícula exposto como aluno';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.candidaturas AS c
    WHERE (
      EXISTS (
        SELECT 1 FROM public.matriculas AS m
        WHERE m.escola_id = c.escola_id AND m.id = c.matricula_id
          AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
      )
      OR EXISTS (
        SELECT 1 FROM public.matriculas AS m
        WHERE m.escola_id = c.escola_id AND m.aluno_id = c.aluno_id
          AND m.ano_letivo = c.ano_letivo
          AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.vw_search_candidaturas AS s
      WHERE s.id = c.id AND s.escola_id = c.escola_id
    )
  ) THEN
    RAISE EXCEPTION 'Regressão: candidatura matriculada duplicada na pesquisa';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.candidaturas AS c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.matriculas AS m
      WHERE m.escola_id = c.escola_id AND m.id = c.matricula_id
        AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.matriculas AS m
        WHERE m.escola_id = c.escola_id AND m.aluno_id = c.aluno_id
          AND m.ano_letivo = c.ano_letivo
          AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.vw_search_candidaturas AS s
        WHERE s.id = c.id AND s.escola_id = c.escola_id
      )
  ) THEN
    RAISE EXCEPTION 'Regressão: candidato sem matrícula desapareceu da pesquisa';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS cl
    JOIN pg_namespace AS n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public'
      AND cl.relname IN ('vw_search_alunos', 'vw_search_candidaturas')
      AND NOT ('security_invoker=true' = ANY(coalesce(cl.reloptions, ARRAY[]::text[])))
  ) THEN
    RAISE EXCEPTION 'Regressão: view deve preservar SECURITY INVOKER';
  END IF;
END;
$test$;

ROLLBACK;
