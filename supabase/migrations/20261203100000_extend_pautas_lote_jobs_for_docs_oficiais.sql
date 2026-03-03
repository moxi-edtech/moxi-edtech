BEGIN;

ALTER TABLE public.pautas_lote_jobs
  ADD COLUMN IF NOT EXISTS documento_tipo text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS manifest_path text,
  ADD COLUMN IF NOT EXISTS zip_checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS signed_url_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

UPDATE public.pautas_lote_jobs
SET documento_tipo = CASE
  WHEN tipo = 'trimestral' THEN 'pauta_trimestral'
  WHEN tipo = 'anual' THEN 'pauta_anual'
  ELSE 'pauta_trimestral'
END
WHERE documento_tipo IS NULL;

ALTER TABLE public.pautas_lote_jobs
  ALTER COLUMN documento_tipo SET DEFAULT 'pauta_trimestral';

ALTER TABLE public.pautas_lote_jobs
  ADD CONSTRAINT chk_pautas_lote_jobs_documento_tipo
  CHECK (documento_tipo IN ('pauta_trimestral', 'pauta_anual', 'boletim', 'certificado'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_pautas_lote_jobs_idempotency
  ON public.pautas_lote_jobs (escola_id, documento_tipo, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.pautas_lote_itens
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS artifact_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

COMMIT;
