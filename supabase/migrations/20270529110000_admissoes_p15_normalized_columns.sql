-- P1.5 Admissoes: nullable normalized columns, backfill, and non-unique indexes.

ALTER TABLE public.candidaturas
  ADD COLUMN IF NOT EXISTS nome_normalizado text,
  ADD COLUMN IF NOT EXISTS documento_normalizado text,
  ADD COLUMN IF NOT EXISTS telefone_normalizado text,
  ADD COLUMN IF NOT EXISTS responsavel_contato_normalizado text;

UPDATE public.candidaturas
SET
  nome_normalizado = nullif(dados_candidato ->> 'nome_normalizado', ''),
  documento_normalizado = nullif(dados_candidato ->> 'documento_normalizado', ''),
  telefone_normalizado = nullif(dados_candidato ->> 'telefone_normalizado', ''),
  responsavel_contato_normalizado = nullif(dados_candidato ->> 'responsavel_contato_normalizado', '')
WHERE
  (
    dados_candidato ? 'nome_normalizado'
    OR dados_candidato ? 'documento_normalizado'
    OR dados_candidato ? 'telefone_normalizado'
    OR dados_candidato ? 'responsavel_contato_normalizado'
  )
  AND (
    nome_normalizado IS DISTINCT FROM nullif(dados_candidato ->> 'nome_normalizado', '')
    OR documento_normalizado IS DISTINCT FROM nullif(dados_candidato ->> 'documento_normalizado', '')
    OR telefone_normalizado IS DISTINCT FROM nullif(dados_candidato ->> 'telefone_normalizado', '')
    OR responsavel_contato_normalizado IS DISTINCT FROM nullif(dados_candidato ->> 'responsavel_contato_normalizado', '')
  );

CREATE INDEX IF NOT EXISTS idx_candidaturas_doc_normalizado_col
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  documento_normalizado
)
WHERE documento_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidaturas_resp_phone_nome_normalizado_col
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  responsavel_contato_normalizado,
  nome_normalizado
)
WHERE responsavel_contato_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidaturas_phone_nome_normalizado_col
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  telefone_normalizado,
  nome_normalizado
)
WHERE telefone_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;
