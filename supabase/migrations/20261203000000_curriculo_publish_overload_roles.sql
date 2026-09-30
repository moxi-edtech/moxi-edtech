BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_old_guard text := $$if not public.user_has_role_in_school(v_escola_id, array['admin_escola']) then
    raise exception 'permission denied: admin_escola required';
  end if;$$;
  v_new_guard text := $$if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola', 'admin', 'admin_financeiro', 'admin_secretaria', 'diretor', 'super_admin', 'global_admin']
  ) then
    raise exception 'permission denied: pedagogical administrator required';
  end if;$$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'curriculo_publish'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_curso_id uuid, p_ano_letivo_id uuid, p_version integer, p_rebuild_turmas boolean';

  IF v_definition IS NULL OR position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'guard legado do overload de cinco argumentos não encontrado';
  END IF;

  EXECUTE replace(v_definition, v_old_guard, v_new_guard);
END;
$migration$;

COMMIT;
