BEGIN;

-- Remove a divergência dos overloads históricos. Eles não são o caminho
-- principal da UI, mas não podem manter uma regra de autorização diferente.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_old_guard text;
  v_new_guard text := $$if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola', 'admin', 'admin_financeiro', 'admin_secretaria', 'diretor', 'super_admin', 'global_admin']
  ) then
    raise exception 'permission denied: pedagogical administrator required';
  end if;$$;
BEGIN
  FOR v_function IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname = 'curriculo_publish_legacy'
        OR (
          p.proname = 'curriculo_publish'
          AND pg_get_function_identity_arguments(p.oid) =
            'p_escola_id uuid, p_curso_id uuid, p_ano_letivo_id uuid, p_version integer, p_rebuild_turmas boolean'
        )
      )
  LOOP
    v_definition := pg_get_functiondef(v_function.oid);

    IF v_definition LIKE '%user_has_role_in_school(v_escola_id, ARRAY[''admin_escola''])%'
       AND v_definition LIKE '%admin_escola required%' THEN
      v_old_guard := $$IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['admin_escola']) THEN
    RAISE EXCEPTION 'permission denied: admin_escola required';
  END IF;$$;
      IF position(v_old_guard IN v_definition) > 0 THEN
        EXECUTE replace(v_definition, v_old_guard, v_new_guard);
      ELSE
        v_old_guard := $$if not public.user_has_role_in_school(v_escola_id, array['admin_escola']) then
    raise exception 'permission denied: admin_escola required';
  end if;$$;
        IF position(v_old_guard IN v_definition) > 0 THEN
          EXECUTE replace(v_definition, v_old_guard, v_new_guard);
        ELSE
          RAISE EXCEPTION 'guard legado não encontrado em %.%', v_function.proname, v_function.identity_args;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$migration$;

COMMIT;
