-- 1. Corrigir índices duplicados

-- Tabela: public.escola_administradores
-- Índices duplicados: escola_administradores_escola_id_user_id_key, idx_escola_admin_unique
-- Ação: Manter escola_administradores_escola_id_user_id_key e remover idx_escola_admin_unique
DROP INDEX IF EXISTS public.idx_escola_admin_unique;

-- Tabela: public.escola_usuarios
-- Índices duplicados: escola_usuarios_escola_id_user_id_key, uq_escola_usuarios_unique
-- Ação: Manter escola_usuarios_escola_id_user_id_key e remover uq_escola_usuarios_unique
DROP INDEX IF EXISTS public.uq_escola_usuarios_unique;

-- Tabela: public.profiles
-- Índices duplicados: profiles_pkey, profiles_user_id_unique
-- Ação: Manter profiles_pkey e remover profiles_user_id_unique
DROP INDEX IF EXISTS public.profiles_user_id_unique;


-- 2. Otimizar políticas de RLS com `(select auth.<function>())`

-- Tabela: public.profiles
-- Política: user_can_update_own_profile
ALTER POLICY user_can_update_own_profile ON public.profiles
  USING (auth.uid() = id)
  WITH CHECK ((select auth.uid()) = id);

-- Política: super_admin_update_role
ALTER POLICY super_admin_update_role ON public.profiles
  USING (true)
  WITH CHECK (check_super_admin_role());

-- Tabela: public.escola_usuarios
-- Política: admin_manage_own_school_users
ALTER POLICY admin_manage_own_school_users ON public.escola_usuarios
  USING (true)
  WITH CHECK (is_escola_admin(escola_id));

-- Política: super_admin_full_access_escola_usuarios
ALTER POLICY super_admin_full_access_escola_usuarios ON public.escola_usuarios
  USING (true)
  WITH CHECK (check_super_admin_role());

-- Política: user_can_view_own_school_links
ALTER POLICY user_can_view_own_school_links ON public.escola_usuarios
  USING (auth.uid() = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Política: diretor_admin_manage_own_school
ALTER POLICY diretor_admin_manage_own_school ON public.escola_usuarios
  USING (true)
  WITH CHECK (is_escola_diretor(escola_id));

-- Tabela: public.escola_administradores
-- Política: super_admin_read_escola_administradores
ALTER POLICY super_admin_read_escola_administradores ON public.escola_administradores
  FOR SELECT
  USING (check_super_admin_role());

-- Tabela: public.profiles
-- Política: profiles_select_own
ALTER POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política: profiles_update_own
ALTER POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK ((select auth.uid()) = id);

-- Política: super_admin_select_profiles
ALTER POLICY super_admin_select_profiles ON public.profiles
  FOR SELECT
  USING (check_super_admin_role());

-- Política: super_admin_update_profiles
ALTER POLICY super_admin_update_profiles ON public.profiles
  FOR UPDATE
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

-- Tabela: public.escolas
-- Política: super_admin_select_escolas
ALTER POLICY super_admin_select_escolas ON public.escolas
  FOR SELECT
  USING (check_super_admin_role());

-- Política: super_admin_insert_escolas
ALTER POLICY super_admin_insert_escolas ON public.escolas
  FOR INSERT
  WITH CHECK (check_super_admin_role());

-- Política: super_admin_update_escolas
ALTER POLICY super_admin_update_escolas ON public.escolas
  FOR UPDATE
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

-- Política: super_admin_delete_escolas
ALTER POLICY super_admin_delete_escolas ON public.escolas
  FOR DELETE
  USING (check_super_admin_role());

-- Tabela: public.escola_administradores
-- Política: super_admin_select_escola_administradores
ALTER POLICY super_admin_select_escola_administradores ON public.escola_administradores
  FOR SELECT
  USING (check_super_admin_role());

-- Política: super_admin_insert_escola_administradores
ALTER POLICY super_admin_insert_escola_administradores ON public.escola_administradores
  FOR INSERT
  WITH CHECK (check_super_admin_role());

-- Política: super_admin_update_escola_administradores
ALTER POLICY super_admin_update_escola_administradores ON public.escola_administradores
  FOR UPDATE
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

-- Política: super_admin_delete_escola_administradores
ALTER POLICY super_admin_delete_escola_administradores ON public.escola_administradores
  FOR DELETE
  USING (check_super_admin_role());

-- Tabela: public.onboarding_drafts
-- Política: onboarding_drafts_upsert_own
ALTER POLICY onboarding_drafts_upsert_own ON public.onboarding_drafts
  USING (auth.uid() = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Tabela: public.turmas
-- Política: select_own_turmas
ALTER POLICY select_own_turmas ON public.turmas
  FOR SELECT
  USING (is_escola_member(escola_id));

-- Política: insert_own_turmas
ALTER POLICY insert_own_turmas ON public.turmas
  FOR INSERT
  WITH CHECK (is_escola_admin(escola_id));

-- Política: update_own_turmas
ALTER POLICY update_own_turmas ON public.turmas
  FOR UPDATE
  USING (is_escola_admin(escola_id))
  WITH CHECK (is_escola_admin(escola_id));

-- Política: delete_own_turmas
ALTER POLICY delete_own_turmas ON public.turmas
  FOR DELETE
  USING (is_escola_admin(escola_id));

-- Tabela: public.audit_logs
-- Política: audit_logs_insert_authenticated
ALTER POLICY audit_logs_insert_authenticated ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Política: audit_logs_select_by_scope
ALTER POLICY audit_logs_select_by_scope ON public.audit_logs
  FOR SELECT
  USING (
    (check_super_admin_role()) OR
    (escola_id IN (SELECT usuarios.escola_id FROM escola_usuarios usuarios WHERE usuarios.user_id = (select auth.uid())))
  );

-- Tabela: public.onboarding_drafts
-- Política: onboarding_drafts_select_own
ALTER POLICY onboarding_drafts_select_own ON public.onboarding_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Tabela: public.classes
-- Política: "classes select membros escola"
ALTER POLICY "classes select membros escola" ON public.classes
  FOR SELECT
  USING (is_escola_member(escola_id));

-- Tabela: public.disciplinas
-- Política: "disciplinas select membros escola"
ALTER POLICY "disciplinas select membros escola" ON public.disciplinas
  FOR SELECT
  USING (is_escola_member(escola_id));

-- Tabela: public.lancamentos_2025_09
-- Política: lancamentos_select_admin
ALTER POLICY lancamentos_select_admin ON public.lancamentos_2025_09
  FOR SELECT
  USING (is_escola_admin(escola_id));

-- Política: lancamentos_write_admin
ALTER POLICY lancamentos_write_admin ON public.lancamentos_2025_09
  USING (is_escola_admin(escola_id))
  WITH CHECK (is_escola_admin(escola_id));


-- 3. Consolidar políticas permissivas múltiplas

-- Tabela: public.escola_usuarios
-- Ação: Unificar políticas para SELECT, INSERT, UPDATE, DELETE

-- SELECT
DROP POLICY IF EXISTS admin_manage_own_school_users ON public.escola_usuarios;
DROP POLICY IF EXISTS diretor_admin_manage_own_school ON public.escola_usuarios;
DROP POLICY IF EXISTS super_admin_full_access_escola_usuarios ON public.escola_usuarios;
DROP POLICY IF EXISTS user_can_view_own_school_links ON public.escola_usuarios;

CREATE POLICY unified_select_escola_usuarios ON public.escola_usuarios
  FOR SELECT
  USING (
    (check_super_admin_role()) OR
    (is_escola_admin(escola_id)) OR
    (is_escola_diretor(escola_id)) OR
    ((select auth.uid()) = user_id)
  );

-- INSERT
DROP POLICY IF EXISTS admin_manage_own_school_users ON public.escola_usuarios;
DROP POLICY IF EXISTS super_admin_full_access_escola_usuarios ON public.escola_usuarios;

CREATE POLICY unified_insert_escola_usuarios ON public.escola_usuarios
  FOR INSERT
  WITH CHECK (
    (check_super_admin_role()) OR
    (is_escola_admin(escola_id))
  );

-- UPDATE
DROP POLICY IF EXISTS admin_manage_own_school_users ON public.escola_usuarios;
DROP POLICY IF EXISTS super_admin_full_access_escola_usuarios ON public.escola_usuarios;

CREATE POLICY unified_update_escola_usuarios ON public.escola_usuarios
  FOR UPDATE
  USING (
    (check_super_admin_role()) OR
    (is_escola_admin(escola_id))
  )
  WITH CHECK (
    (check_super_admin_role()) OR
    (is_escola_admin(escola_id))
  );

-- DELETE
DROP POLICY IF EXISTS admin_manage_own_school_users ON public.escola_usuarios;
DROP POLICY IF EXISTS super_admin_full_access_escola_usuarios ON public.escola_usuarios;

CREATE POLICY unified_delete_escola_usuarios ON public.escola_usuarios
  FOR DELETE
  USING (
    (check_super_admin_role()) OR
    (is_escola_admin(escola_id))
  );


-- Tabela: public.profiles
-- Ação: Unificar políticas para UPDATE

DROP POLICY IF EXISTS super_admin_update_role ON public.profiles;
DROP POLICY IF EXISTS user_can_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS super_admin_update_profiles ON public.profiles;

CREATE POLICY unified_update_profiles ON public.profiles
  FOR UPDATE
  USING (
    (check_super_admin_role()) OR
    ((select auth.uid()) = id)
  )
  WITH CHECK (
    (check_super_admin_role()) OR
    ((select auth.uid()) = id)
  );


-- Tabela: public.escola_administradores
-- Ação: Unificar políticas para SELECT, INSERT, UPDATE, DELETE

-- SELECT
DROP POLICY IF EXISTS "Superadmins gerenciam administradores escolares" ON public.escola_administradores;
DROP POLICY IF EXISTS super_admin_read_escola_administradores ON public.escola_administradores;
DROP POLICY IF EXISTS super_admin_select_escola_administradores ON public.escola_administradores;

CREATE POLICY unified_select_escola_administradores ON public.escola_administradores
  FOR SELECT
  USING (check_super_admin_role());

-- INSERT
DROP POLICY IF EXISTS "Superadmins gerenciam administradores escolares" ON public.escola_administradores;
DROP POLICY IF EXISTS super_admin_insert_escola_administradores ON public.escola_administradores;

CREATE POLICY unified_insert_escola_administradores ON public.escola_administradores
  FOR INSERT
  WITH CHECK (check_super_admin_role());

-- UPDATE
DROP POLICY IF EXISTS "Superadmins gerenciam administradores escolares" ON public.escola_administradores;
DROP POLICY IF EXISTS super_admin_update_escola_administradores ON public.escola_administradores;

CREATE POLICY unified_update_escola_administradores ON public.escola_administradores
  FOR UPDATE
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

-- DELETE
DROP POLICY IF EXISTS "Superadmins gerenciam administradores escolares" ON public.escola_administradores;
DROP POLICY IF EXISTS super_admin_delete_escola_administradores ON public.escola_administradores;

CREATE POLICY unified_delete_escola_administradores ON public.escola_administradores
  FOR DELETE
  USING (check_super_admin_role());


-- Tabela: public.escolas
-- Ação: Unificar políticas para SELECT, INSERT, UPDATE, DELETE

-- SELECT
DROP POLICY IF EXISTS super_admin_select_escolas ON public.escolas;
DROP POLICY IF EXISTS "superadmin pode tudo em escolas" ON public.escolas;

CREATE POLICY unified_select_escolas ON public.escolas
  FOR SELECT
  USING (check_super_admin_role());

-- INSERT
DROP POLICY IF EXISTS super_admin_insert_escolas ON public.escolas;
DROP POLICY IF EXISTS "superadmin pode tudo em escolas" ON public.escolas;

CREATE POLICY unified_insert_escolas ON public.escolas
  FOR INSERT
  WITH CHECK (check_super_admin_role());

-- UPDATE
DROP POLICY IF EXISTS super_admin_update_escolas ON public.escolas;
DROP POLICY IF EXISTS "superadmin pode tudo em escolas" ON public.escolas;

CREATE POLICY unified_update_escolas ON public.escolas
  FOR UPDATE
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

-- DELETE
DROP POLICY IF EXISTS super_admin_delete_escolas ON public.escolas;
DROP POLICY IF EXISTS "superadmin pode tudo em escolas" ON public.escolas;

CREATE POLICY unified_delete_escolas ON public.escolas
  FOR DELETE
  USING (check_super_admin_role());


-- Tabela: public.lancamentos_2025_09
-- Ação: Unificar políticas para SELECT, INSERT, UPDATE, DELETE

-- SELECT
DROP POLICY IF EXISTS lancamentos_select_admin ON public.lancamentos_2025_09;
DROP POLICY IF EXISTS lancamentos_tenant_select ON public.lancamentos_2025_09;
DROP POLICY IF EXISTS lancamentos_write_admin ON public.lancamentos_2025_09;

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2025_09
  FOR SELECT
  USING (
    (is_escola_admin(escola_id)) OR
    (is_escola_member(escola_id))
  );

-- INSERT
DROP POLICY IF EXISTS lancamentos_tenant_insert ON public.lancamentos_2025_09;
DROP POLICY IF EXISTS lancamentos_write_admin ON public.lancamentos_2025_09;

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2025_09
  FOR INSERT
  WITH CHECK (
    (is_escola_admin(escola_id)) OR
    (is_escola_member(escola_id))
  );

-- UPDATE
DROP POLICY IF EXISTS lancamentos_tenant_update ON public.lancamentos_2025_09;
DROP POLICY IF EXISTS lancamentos_write_admin ON public.lancamentos_2025_09;

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2025_09
  FOR UPDATE
  USING (
    (is_escola_admin(escola_id)) OR
    (is_escola_member(escola_id))
  )
  WITH CHECK (
    (is_escola_admin(escola_id)) OR
    (is_escola_member(escola_id))
  );

-- DELETE
DROP POLICY IF EXISTS lancamentos_tenant_delete ON public.lancamentos_2025_09;
DROP POLICY IF EXISTS lancamentos_write_admin ON public.lancamentos_2025_09;

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2025_09
  FOR DELETE
  USING (
    (is_escola_admin(escola_id)) OR
    (is_escola_member(escola_id))
  );


-- Tabela: public.onboarding_drafts
-- Ação: Unificar políticas para SELECT

DROP POLICY IF EXISTS onboarding_drafts_select_own ON public.onboarding_drafts;
DROP POLICY IF EXISTS onboarding_drafts_upsert_own ON public.onboarding_drafts;

CREATE POLICY unified_select_onboarding_drafts ON public.onboarding_drafts
  FOR SELECT
  USING ((select auth.uid()) = user_id);


-- Tabela: public.profiles
-- Ação: Unificar políticas para SELECT

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS super_admin_select_profiles ON public.profiles;

CREATE POLICY unified_select_profiles ON public.profiles
  FOR SELECT
  USING (
    (check_super_admin_role()) OR
    ((select auth.uid()) = id)
  );
