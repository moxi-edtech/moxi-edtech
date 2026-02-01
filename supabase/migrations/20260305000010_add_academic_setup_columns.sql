BEGIN;

ALTER TABLE public.periodos_letivos
  ADD COLUMN IF NOT EXISTS peso smallint;

ALTER TABLE public.periodos_letivos
  ADD CONSTRAINT periodos_letivos_peso_check
  CHECK (peso IS NULL OR (peso >= 0 AND peso <= 100));

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS ano_letivo_id uuid;

UPDATE public.turmas t
   SET ano_letivo_id = al.id
  FROM public.anos_letivos al
 WHERE t.ano_letivo_id IS NULL
   AND al.escola_id = t.escola_id
   AND al.ano = t.ano_letivo;

CREATE INDEX IF NOT EXISTS idx_turmas_escola_ano_letivo_id
  ON public.turmas (escola_id, ano_letivo_id);

COMMIT;
