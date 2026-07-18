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
  SELECT pg_get_functiondef(p_function::oid)
  INTO v_definition;

  IF strpos(v_definition, p_old) = 0 THEN
    RAISE EXCEPTION 'Expected fragment not found in %', p_function;
  END IF;

  v_definition := replace(v_definition, p_old, p_new);
  EXECUTE v_definition;
END;
$helper$;

SELECT pg_temp.replace_function_fragment(
  'public.increment_documento_print(uuid,uuid,text)'::regprocedure,
  $old$  UPDATE public.documentos_emitidos
  SET print_count = coalesce(print_count, 0) + 1,
      last_printed_at = now()
  WHERE id = p_doc_id$old$,
  $new$  UPDATE public.documentos_emitidos AS de
  SET print_count = coalesce(de.print_count, 0) + 1,
      last_printed_at = now()
  WHERE de.id = p_doc_id$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.increment_documento_print(uuid,uuid,text)'::regprocedure,
  $old$    user_id,
    user_email,
    portal,$old$,
  $new$    user_id,
    portal,$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.increment_documento_print(uuid,uuid,text)'::regprocedure,
  $old$    p_actor_id,
    p_actor_email,
    'secretaria',$old$,
  $new$    p_actor_id,
    'secretaria',$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.increment_documento_print(uuid,uuid,text)'::regprocedure,
  $old$      'print_count', coalesce(v_doc.print_count, 0),
      'timestamp', now()
$old$,
  $new$      'print_count', coalesce(v_doc.print_count, 0),
      'timestamp', now(),
      'actor_email', p_actor_email
$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.upsert_frequencias_batch(uuid,uuid,uuid,date,jsonb)'::regprocedure,
  $old$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now()$old$,
  $new$      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.get_classes_sem_preco(uuid,integer)'::regprocedure,
  $old$    cur.escola_id = p_escola_id
    AND cur.ativo = true
    AND ($old$,
  $new$    cur.escola_id = p_escola_id
    AND ($new$
);

SELECT pg_temp.replace_function_fragment(
  'public.create_and_provision_escola_from_onboarding(uuid,text,text,text,text,text,text,text,uuid)'::regprocedure,
  $old$    SET plano_atual = p_plano
$old$,
  $new$    SET plano_atual = p_plano::public.app_plan_tier
$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.provisionar_escola_from_onboarding(uuid,uuid,uuid)'::regprocedure,
  $old$  INSERT INTO public.anos_letivos (escola_id, ano, nome, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id,
    v_req.ano_letivo::int,
    'Ano Letivo ' || v_req.ano_letivo,
    (v_req.ano_letivo || '-02-01')::date,$old$,
  $new$  INSERT INTO public.anos_letivos (escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id,
    v_req.ano_letivo::int,
    (v_req.ano_letivo || '-02-01')::date,$new$
);

COMMIT;
