BEGIN;

-- Decisão de produto: substituir "declaracao_notas" por "boletim_trimestral" no catálogo oficial.
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'boletim_trimestral';

-- Compatibilidade histórica: migrar documentos já emitidos para o novo tipo oficial.
UPDATE public.documentos_emitidos
SET tipo = 'boletim_trimestral'::public.tipo_documento,
    dados_snapshot = jsonb_set(
      jsonb_set(coalesce(dados_snapshot, '{}'::jsonb), '{tipo_documento}', '"boletim_trimestral"'::jsonb, true),
      '{legacy_tipo_documento}',
      '"declaracao_notas"'::jsonb,
      true
    )
WHERE tipo = 'declaracao_notas'::public.tipo_documento;

-- Compatibilidade de jobs: novo tipo oficial para lotes de boletim.
ALTER TABLE public.pautas_lote_jobs DROP CONSTRAINT IF EXISTS chk_pautas_lote_jobs_documento_tipo;
ALTER TABLE public.pautas_lote_jobs
  ADD CONSTRAINT chk_pautas_lote_jobs_documento_tipo
  CHECK (documento_tipo IN ('pauta_trimestral', 'pauta_anual', 'boletim_trimestral', 'boletim', 'certificado'));

COMMIT;
