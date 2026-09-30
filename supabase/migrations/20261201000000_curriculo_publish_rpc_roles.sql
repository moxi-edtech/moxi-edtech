BEGIN;

-- A migration de políticas pode ser aplicada antes da criação do RPC. Esta
-- migration garante a atualização do corpo da função após 20261128000000.
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
    AND p.proname = 'curriculo_publish_single'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_curso_id uuid, p_ano_letivo_id uuid, p_version integer, p_rebuild_turmas boolean, p_classe_id uuid';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'curriculo_publish_single(uuid,uuid,uuid,integer,boolean,uuid) não encontrado';
  END IF;

  IF position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'guard legado de curriculo_publish_single não encontrado; migration interrompida';
  END IF;

  EXECUTE replace(v_definition, v_old_guard, v_new_guard);
END;
$migration$;

COMMIT;
