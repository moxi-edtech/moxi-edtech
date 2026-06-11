BEGIN;

ALTER TABLE public.candidaturas
  DROP CONSTRAINT IF EXISTS candidaturas_required_when_not_draft;

ALTER TABLE public.candidaturas
  ADD CONSTRAINT candidaturas_required_when_not_draft
  CHECK (
    status IN ('rascunho', 'pre_candidatura')
    OR (curso_id IS NOT NULL AND ano_letivo IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_pre_doc_normalizado
ON public.candidaturas (
  escola_id,
  curso_id,
  documento_normalizado
)
WHERE status = 'pre_candidatura'
  AND ano_letivo IS NULL
  AND documento_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_pre_resp_phone_nome_normalizado
ON public.candidaturas (
  escola_id,
  curso_id,
  responsavel_contato_normalizado,
  nome_normalizado
)
WHERE status = 'pre_candidatura'
  AND ano_letivo IS NULL
  AND responsavel_contato_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_pre_phone_nome_normalizado
ON public.candidaturas (
  escola_id,
  curso_id,
  telefone_normalizado,
  nome_normalizado
)
WHERE status = 'pre_candidatura'
  AND ano_letivo IS NULL
  AND telefone_normalizado IS NOT NULL
  AND nome_normalizado IS NOT NULL;

COMMIT;
