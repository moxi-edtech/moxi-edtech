BEGIN;

WITH source AS (
  SELECT
    a.id AS aluno_id,
    a.escola_id,
    COALESCE(a.responsavel_nome, a.responsavel, a.encarregado_nome) AS nome,
    COALESCE(a.responsavel_contato, a.telefone_responsavel, a.encarregado_telefone) AS telefone,
    a.encarregado_email AS email,
    NULL::text AS relacao
  FROM public.alunos a
  WHERE a.encarregado_email IS NOT NULL
),
upserted AS (
  INSERT INTO public.encarregados (escola_id, nome, telefone, email)
  SELECT DISTINCT ON (escola_id, email)
    escola_id,
    COALESCE(nome, 'Encarregado'),
    telefone,
    email
  FROM source
  ORDER BY escola_id, email
  ON CONFLICT (escola_id, email) WHERE email IS NOT NULL
  DO UPDATE SET
    nome = excluded.nome,
    telefone = COALESCE(excluded.telefone, public.encarregados.telefone)
  RETURNING id, escola_id, email
)
INSERT INTO public.aluno_encarregados (escola_id, aluno_id, encarregado_id, relacao, principal)
SELECT
  s.escola_id,
  s.aluno_id,
  u.id,
  s.relacao,
  true
FROM source s
JOIN upserted u
  ON u.escola_id = s.escola_id
  AND u.email = s.email
ON CONFLICT (aluno_id, encarregado_id)
DO UPDATE SET
  principal = true,
  relacao = COALESCE(excluded.relacao, public.aluno_encarregados.relacao);

COMMIT;
