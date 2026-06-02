-- P1.6 Admissoes: enforce duplicate protection with unique partial indexes.

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_doc_normalizado
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  documento_normalizado
)
WHERE documento_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_resp_phone_nome_normalizado
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  responsavel_contato_normalizado,
  nome_normalizado
)
WHERE responsavel_contato_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_phone_nome_normalizado
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  telefone_normalizado,
  nome_normalizado
)
WHERE telefone_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;
