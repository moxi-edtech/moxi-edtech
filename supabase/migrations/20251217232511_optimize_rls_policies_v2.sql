BEGIN;

-- =================================================================
-- 1. CONFIGURAÇÕES CURRÍCULO (Correção da Lógica Circular)
-- =================================================================
DROP POLICY IF EXISTS "Escola gerencia config" ON public.configuracoes_curriculo;

CREATE POLICY "Escola gerencia config" ON public.configuracoes_curriculo
  FOR ALL
  TO authenticated -- Melhor que public
  USING (
    -- O usuário deve pertencer à mesma escola da configuração
    escola_id IN (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    escola_id IN (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
    )
  );

-- =================================================================
-- 2. DISCIPLINAS (Correção da Lógica Circular)
-- =================================================================
DROP POLICY IF EXISTS "Escola cria suas disciplinas" ON public.disciplinas;
DROP POLICY IF EXISTS "Escola vê suas disciplinas" ON public.disciplinas;

-- Unificando Criação e Visualização
CREATE POLICY "disciplinas_isolation_opt" ON public.disciplinas
  FOR ALL
  TO authenticated
  USING (
    escola_id IN (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
    )
  );

-- =================================================================
-- 3. PROFILES (Otimização de Performance)
-- =================================================================
-- Unificando as políticas de admin/super_admin/próprio usuário
DROP POLICY IF EXISTS "unified_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "unified_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "global_admin_full_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_escola_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_global_admin_all" ON public.profiles;

CREATE POLICY "profiles_select_opt" ON public.profiles
  FOR SELECT
  TO public
  USING (
    -- 1. O próprio usuário vê seu perfil
    user_id = (select auth.uid())
    OR
    -- 2. Staff vê perfis da mesma escola
    (
      escola_id = (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
      )
    )
    OR
    -- 3. Super Admin (mantendo sua função helper se existir)
    check_super_admin_role()
  );

CREATE POLICY "profiles_update_opt" ON public.profiles
  FOR UPDATE
  TO public
  USING (
    user_id = (select auth.uid()) 
    OR 
    check_super_admin_role()
  );

-- =================================================================
-- 4. CACHE GLOBAL (Otimização do auth.role)
-- =================================================================
DROP POLICY IF EXISTS "Autenticados podem inserir" ON public.cursos_globais_cache;
DROP POLICY IF EXISTS "Autenticados podem sugerir novos cursos" ON public.cursos_globais_cache;
DROP POLICY IF EXISTS "AuthInsert" ON public.cursos_globais_cache;

CREATE POLICY "cursos_globais_insert_opt" ON public.cursos_globais_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Se está autenticado, pode inserir (simplificação segura para cache)

-- =================================================================
-- 5. AUDIT LOGS & ESCOLA USERS
-- =================================================================
DROP POLICY IF EXISTS "audit_logs_select_by_scope" ON public.audit_logs;
CREATE POLICY "audit_logs_select_by_scope" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Super admin vê tudo OU usuário vê logs da sua escola
    check_super_admin_role() 
    OR 
    escola_id IN (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios veem suas proprias escolas" ON public.escola_users;
CREATE POLICY "Usuarios veem suas proprias escolas" ON public.escola_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
  );

-- =================================================================
-- 6. CLASSES (Otimização Final)
-- =================================================================
DROP POLICY IF EXISTS "delete_own_classes" ON public.classes;
DROP POLICY IF EXISTS "insert_own_classes" ON public.classes;
DROP POLICY IF EXISTS "update_own_classes" ON public.classes;

-- Já criamos "classes_select_unificado" no script anterior.
-- Vamos criar uma política de ESCRITA (Insert/Update/Delete) unificada para Staff.

CREATE POLICY "classes_write_staff_opt" ON public.classes
  FOR ALL
  TO authenticated
  USING (
    is_staff_escola(escola_id) 
    AND 
    escola_id IN (
        SELECT p.escola_id 
        FROM profiles p 
        WHERE p.user_id = (select auth.uid())
    )
  );

COMMIT;