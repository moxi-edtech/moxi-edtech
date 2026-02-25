BEGIN;

WITH latest_cand AS (
  SELECT DISTINCT ON (c.aluno_id)
    c.aluno_id,
    c.escola_id,
    c.dados_candidato
  FROM public.candidaturas c
  WHERE c.aluno_id IS NOT NULL
  ORDER BY c.aluno_id, c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
)
UPDATE public.alunos a
SET
  responsavel = COALESCE(
    a.responsavel,
    lc.dados_candidato->>'responsavel',
    lc.dados_candidato->>'responsavel_nome',
    lc.dados_candidato->>'encarregado_nome'
  ),
  responsavel_nome = COALESCE(
    a.responsavel_nome,
    lc.dados_candidato->>'responsavel_nome'
  ),
  responsavel_contato = COALESCE(
    a.responsavel_contato,
    lc.dados_candidato->>'responsavel_contato'
  ),
  encarregado_nome = COALESCE(
    a.encarregado_nome,
    lc.dados_candidato->>'encarregado_nome'
  ),
  encarregado_telefone = COALESCE(
    a.encarregado_telefone,
    lc.dados_candidato->>'encarregado_telefone'
  ),
  encarregado_email = COALESCE(
    a.encarregado_email,
    lc.dados_candidato->>'encarregado_email'
  ),
  telefone_responsavel = COALESCE(
    a.telefone_responsavel,
    lc.dados_candidato->>'telefone_responsavel',
    lc.dados_candidato->>'responsavel_contato',
    lc.dados_candidato->>'encarregado_telefone',
    lc.dados_candidato->>'telefone'
  ),
  email = COALESCE(
    a.email,
    lc.dados_candidato->>'email',
    lc.dados_candidato->>'encarregado_email'
  )
FROM latest_cand lc
WHERE a.id = lc.aluno_id
  AND a.escola_id = lc.escola_id
  AND (
    a.responsavel IS NULL
    OR a.responsavel_nome IS NULL
    OR a.encarregado_nome IS NULL
    OR a.telefone_responsavel IS NULL
  );

COMMIT;
