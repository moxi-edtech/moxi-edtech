BEGIN;

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
    RAISE EXCEPTION 'Expected rollback fragment not found in %', p_function;
  END IF;
  EXECUTE replace(v_definition, p_old, p_new);
END;
$helper$;

SELECT pg_temp.replace_function_fragment(
  'public.upsert_frequencias_batch(uuid,uuid,uuid,date,jsonb)'::regprocedure,
  $old$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status$old$,
  $new$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now()$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.provisionar_escola_from_onboarding(uuid,uuid,uuid)'::regprocedure,
  $old$  INSERT INTO public.anos_letivos (escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id,
    v_req.ano_letivo::int,
    (v_req.ano_letivo || '-02-01')::date,$old$,
  $new$  INSERT INTO public.anos_letivos (escola_id, ano, nome, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id,
    v_req.ano_letivo::int,
    'Ano Letivo ' || v_req.ano_letivo,
    (v_req.ano_letivo || '-02-01')::date,$new$
);

COMMIT;
