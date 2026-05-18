BEGIN;

ALTER TABLE public.pautas_lote_jobs
  DROP CONSTRAINT IF EXISTS chk_pautas_lote_jobs_documento_tipo;

ALTER TABLE public.pautas_lote_jobs
  ADD CONSTRAINT chk_pautas_lote_jobs_documento_tipo
  CHECK (
    documento_tipo IN (
      'pauta_trimestral',
      'pauta_anual',
      'boletim_trimestral',
      'boletim',
      'certificado',
      'lista_nominal',
      'mapa_frequencia'
    )
  );

COMMIT;
