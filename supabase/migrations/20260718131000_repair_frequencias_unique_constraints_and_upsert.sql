BEGIN;

ALTER TABLE public.frequencias_2025_09
  ADD CONSTRAINT uq_frequencias_2025_09_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_2025_10
  ADD CONSTRAINT uq_frequencias_2025_10_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_2025_11
  ADD CONSTRAINT uq_frequencias_2025_11_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_2025_12
  ADD CONSTRAINT uq_frequencias_2025_12_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_2026_01
  ADD CONSTRAINT uq_frequencias_2026_01_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_2026_02
  ADD CONSTRAINT uq_frequencias_2026_02_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);
ALTER TABLE public.frequencias_default
  ADD CONSTRAINT uq_frequencias_default_ssot_por_aula
  UNIQUE (escola_id, matricula_id, data, aula_id);

ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2025_09_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2025_10_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2025_11_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2025_12_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2026_01_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_2026_02_ssot_por_aula;
ALTER INDEX public.uq_frequencias_ssot_por_aula
  ATTACH PARTITION public.uq_frequencias_default_ssot_por_aula;

CREATE FUNCTION pg_temp.replace_function_fragment(
  p_function regprocedure,
  p_old text,
  p_new text
)
RETURNS void
LANGUAGE plpgsql
AS $helper$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p_function::oid) INTO v_definition;
  IF strpos(v_definition, p_old) = 0 THEN
    RAISE EXCEPTION 'Expected fragment not found in %', p_function;
  END IF;
  EXECUTE replace(v_definition, p_old, p_new);
END;
$helper$;

SELECT pg_temp.replace_function_fragment(
  'public.upsert_frequencias_batch(uuid,uuid,uuid,date,jsonb)'::regprocedure,
  $old$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now()$old$,
  $new$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status$new$
);

COMMIT;
