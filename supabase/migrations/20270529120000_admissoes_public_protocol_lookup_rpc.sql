CREATE OR REPLACE FUNCTION public.admissao_public_lookup_by_protocolo(
  p_escola_id uuid,
  p_protocolo text
)
RETURNS TABLE (
  id uuid,
  status text,
  aluno_id uuid,
  nome_candidato text,
  responsavel_contato_normalizado text,
  dados_candidato jsonb,
  curso_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.status,
    c.aluno_id,
    c.nome_candidato,
    c.responsavel_contato_normalizado,
    c.dados_candidato,
    cursos.nome AS curso_nome
  FROM public.candidaturas c
  LEFT JOIN public.cursos cursos
    ON cursos.id = c.curso_id
   AND cursos.escola_id = c.escola_id
  WHERE c.escola_id = p_escola_id
    AND c.id::text ILIKE lower(btrim(p_protocolo)) || '%'
  ORDER BY c.created_at DESC NULLS LAST, c.id DESC
  LIMIT 2;
$$;

REVOKE ALL ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) TO anon, authenticated, service_role;
