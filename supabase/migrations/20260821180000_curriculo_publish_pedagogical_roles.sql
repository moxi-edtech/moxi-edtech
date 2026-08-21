BEGIN;

-- A publicação do currículo é uma operação pedagógica. O RPC legado tinha
-- ficado restrito a admin_escola, apesar de a aplicação já autorizar os
-- administradores pedagógicos do tenant.
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
    AND oidvectortypes(p.proargtypes) = 'uuid,uuid,uuid,integer,boolean,uuid';

  IF v_definition IS NULL THEN
    -- A função é criada pela migration 20261128000000; esta parte será
    -- reaplicada pela migration posterior quando ela já existir.
    RETURN;
  END IF;

  IF position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'guard legado de curriculo_publish_single não encontrado; migration interrompida';
  END IF;

  EXECUTE replace(v_definition, v_old_guard, v_new_guard);
END;
$migration$;

-- O RPC é SECURITY INVOKER: as políticas das tabelas também precisam refletir
-- a mesma fronteira de autorização, caso contrário a função passa no guard e
-- falha ao publicar por RLS.
DROP POLICY IF EXISTS curso_curriculos_delete_admin ON public.curso_curriculos;
CREATE POLICY curso_curriculos_delete_admin
  ON public.curso_curriculos FOR DELETE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS curso_curriculos_insert_admin ON public.curso_curriculos;
CREATE POLICY curso_curriculos_insert_admin
  ON public.curso_curriculos FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS curso_curriculos_update_admin ON public.curso_curriculos;
CREATE POLICY curso_curriculos_update_admin
  ON public.curso_curriculos FOR UPDATE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS curso_matriz_insert ON public.curso_matriz;
CREATE POLICY curso_matriz_insert
  ON public.curso_matriz FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS curso_matriz_update ON public.curso_matriz;
CREATE POLICY curso_matriz_update
  ON public.curso_matriz FOR UPDATE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS curso_matriz_delete ON public.curso_matriz;
CREATE POLICY curso_matriz_delete
  ON public.curso_matriz FOR DELETE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS turma_disciplinas_insert ON public.turma_disciplinas;
CREATE POLICY turma_disciplinas_insert
  ON public.turma_disciplinas FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS turma_disciplinas_update ON public.turma_disciplinas;
CREATE POLICY turma_disciplinas_update
  ON public.turma_disciplinas FOR UPDATE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

DROP POLICY IF EXISTS turma_disciplinas_delete ON public.turma_disciplinas;
CREATE POLICY turma_disciplinas_delete
  ON public.turma_disciplinas FOR DELETE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY[
      'admin_escola','admin','admin_financeiro','admin_secretaria','diretor','super_admin','global_admin'
    ])
  );

COMMIT;
