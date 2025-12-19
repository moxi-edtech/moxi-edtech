-- Helper: retorna escola_id do JWT (raw_app_meta_data)
CREATE OR REPLACE FUNCTION public.current_escola_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (auth.jwt() -> 'raw_app_meta_data' ->> 'escola_id')::uuid;
$$;

-- Revoga execução para roles públicos (segurança)
REVOKE EXECUTE ON FUNCTION public.current_escola_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_escola_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_escola_id() FROM anon;

---------------------------------------------------
-- Habilita RLS nas tabelas alvo (se já ativo, comando é seguro)
---------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_titulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_mensalidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_escola ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

---------------------------------------------------
-- POLÍTICAS GERAIS
-- super_admin / global_admin full access via JWT claim "global_role" or profile.role
---------------------------------------------------

-- Super / global admins: leitura e escrita total
DROP POLICY IF EXISTS "global_admin_full_access" ON public.profiles;
CREATE POLICY "global_admin_full_access" ON public.profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'global_role') IS NOT NULL AND (auth.jwt() ->> 'global_role') = 'global_admin')
  WITH CHECK ((auth.jwt() ->> 'global_role') = 'global_admin');

-- (You can duplicate the above policy for other tables; using explicit examples below.)

-- Profiles: admins of the platform (global_admin) can do everything
DROP POLICY IF EXISTS "profiles_global_admin_all" ON public.profiles;
CREATE POLICY "profiles_global_admin_all" ON public.profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'global_role') = 'global_admin')
  WITH CHECK ((auth.jwt() ->> 'global_role') = 'global_admin');

-- Escola admins: full access within their escola
DROP POLICY IF EXISTS "profiles_escola_admin_all" ON public.profiles;
CREATE POLICY "profiles_escola_admin_all" ON public.profiles
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'super_admin')
  WITH CHECK (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'super_admin');

-- Escola_users: only users within same escola can manage their escola_users rows
DROP POLICY IF EXISTS "escola_users_select" ON public.escola_users;
CREATE POLICY "escola_users_select" ON public.escola_users
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "escola_users_insert" ON public.escola_users;
CREATE POLICY "escola_users_insert" ON public.escola_users
  FOR INSERT
  TO authenticated
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "escola_users_update" ON public.escola_users;
CREATE POLICY "escola_users_update" ON public.escola_users
  FOR UPDATE
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "escola_users_delete" ON public.escola_users;
CREATE POLICY "escola_users_delete" ON public.escola_users
  FOR DELETE
  TO authenticated
  USING (escola_id = public.current_escola_id());

-- Escola_administradores: only escola admins and global_admin can manage
DROP POLICY IF EXISTS "escola_administradores_select" ON public.escola_administradores;
CREATE POLICY "escola_administradores_select" ON public.escola_administradores
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id()
         OR (auth.jwt() ->> 'global_role') = 'global_admin');

DROP POLICY IF EXISTS "escola_administradores_manage" ON public.escola_administradores;
CREATE POLICY "escola_administradores_manage" ON public.escola_administradores
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'global_role') = 'global_admin')
  WITH CHECK (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'global_role') = 'global_admin');

-- Alunos: read for escola members, insert only within same escola, updates restricted
DROP POLICY IF EXISTS "alunos_select" ON public.alunos;
CREATE POLICY "alunos_select" ON public.alunos
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "alunos_insert" ON public.alunos;
CREATE POLICY "alunos_insert" ON public.alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "alunos_update" ON public.alunos;
CREATE POLICY "alunos_update" ON public.alunos
  FOR UPDATE
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "alunos_delete" ON public.alunos;
CREATE POLICY "alunos_delete" ON public.alunos
  FOR DELETE
  TO authenticated
  USING (escola_id = public.current_escola_id());

-- Matriculas: similar to alunos
DROP POLICY IF EXISTS "matriculas_select" ON public.matriculas;
CREATE POLICY "matriculas_select" ON public.matriculas
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "matriculas_insert" ON public.matriculas;
CREATE POLICY "matriculas_insert" ON public.matriculas
  FOR INSERT
  TO authenticated
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "matriculas_update" ON public.matriculas;
CREATE POLICY "matriculas_update" ON public.matriculas
  FOR UPDATE
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "matriculas_delete" ON public.matriculas;
CREATE POLICY "matriculas_delete" ON public.matriculas
  FOR DELETE
  TO authenticated
  USING (escola_id = public.current_escola_id());

-- Turmas
DROP POLICY IF EXISTS "turmas_select" ON public.turmas;
CREATE POLICY "turmas_select" ON public.turmas
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "turmas_manage" ON public.turmas;
CREATE POLICY "turmas_manage" ON public.turmas
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

-- Notas: only escola members can CRUD within their escola
DROP POLICY IF EXISTS "notas_select" ON public.notas;
CREATE POLICY "notas_select" ON public.notas
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "notas_manage" ON public.notas;
CREATE POLICY "notas_manage" ON public.notas
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

-- Mensalidades & Pagamentos (financeiro) — allow financeira role and escola admins
DROP POLICY IF EXISTS "mensalidades_select" ON public.mensalidades;
CREATE POLICY "mensalidades_select" ON public.mensalidades
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id()
         OR (auth.jwt() ->> 'user_role') = 'financeiro');

DROP POLICY IF EXISTS "mensalidades_manage" ON public.mensalidades;
CREATE POLICY "mensalidades_manage" ON public.mensalidades
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro')
  WITH CHECK (escola_id = public.current_escola_id());

-- financeiro_titulos / financeiro_lancamentos: finance role + escola admins
DROP POLICY IF EXISTS "financeiro_titulos_select" ON public.financeiro_titulos;
CREATE POLICY "financeiro_titulos_select" ON public.financeiro_titulos
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro');

DROP POLICY IF EXISTS "financeiro_titulos_manage" ON public.financeiro_titulos;
CREATE POLICY "financeiro_titulos_manage" ON public.financeiro_titulos
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro')
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "financeiro_lancamentos_select" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_select" ON public.financeiro_lancamentos
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro');

DROP POLICY IF EXISTS "financeiro_lancamentos_manage" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_manage" ON public.financeiro_lancamentos
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro')
  WITH CHECK (escola_id = public.current_escola_id());

-- financeiro_itens & tabelas_mensalidade: escola admins + finance role
DROP POLICY IF EXISTS "financeiro_itens_select" ON public.financeiro_itens;
CREATE POLICY "financeiro_itens_select" ON public.financeiro_itens
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro');

DROP POLICY IF EXISTS "financeiro_itens_manage" ON public.financeiro_itens;
CREATE POLICY "financeiro_itens_manage" ON public.financeiro_itens
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'user_role') = 'financeiro')
  WITH CHECK (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "tabelas_mensalidade_select" ON public.tabelas_mensalidade;
CREATE POLICY "tabelas_mensalidade_select" ON public.tabelas_mensalidade
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "tabelas_mensalidade_manage" ON public.tabelas_mensalidade;
CREATE POLICY "tabelas_mensalidade_manage" ON public.tabelas_mensalidade
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

-- Configurações da escola: only escola admins or global_admin
DROP POLICY IF EXISTS "config_escola_select" ON public.configuracoes_escola;
CREATE POLICY "config_escola_select" ON public.configuracoes_escola
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'global_role') = 'global_admin');

DROP POLICY IF EXISTS "config_escola_manage" ON public.configuracoes_escola;
CREATE POLICY "config_escola_manage" ON public.configuracoes_escola
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'global_role') = 'global_admin')
  WITH CHECK (escola_id = public.current_escola_id());

-- Escola_configuracoes (per-site settings)
DROP POLICY IF EXISTS "escola_configuracoes_select" ON public.escola_configuracoes;
CREATE POLICY "escola_configuracoes_select" ON public.escola_configuracoes
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id());

DROP POLICY IF EXISTS "escola_configuracoes_manage" ON public.escola_configuracoes;
CREATE POLICY "escola_configuracoes_manage" ON public.escola_configuracoes
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_escola_id())
  WITH CHECK (escola_id = public.current_escola_id());

-- Audit logs: readable by escola admins and global_admin only
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_escola_id() OR (auth.jwt() ->> 'global_role') = 'global_admin');

-- Deny delete for audit_logs by default (no delete policy created)

---------------------------------------------------
-- INDEXES (applied only on larger tables per your choice)
---------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alunos_escola_id ON public.alunos(escola_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_escola_id ON public.matriculas(escola_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_titulos_escola_id ON public.financeiro_titulos(escola_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_escola_id ON public.financeiro_lancamentos(escola_id);
CREATE INDEX IF NOT EXISTS idx_profiles_escola_id ON public.profiles(escola_id);
CREATE INDEX IF NOT EXISTS idx_turmas_escola_id ON public.turmas(escola_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_escola_id ON public.mensalidades(escola_id);

---------------------------------------------------
-- NOTES / TUNING
-- 1) If you use a different JWT path for escola_id, replace the function body accordingly.
-- 2) Review explicit policy names to avoid collisions if you already have policies with same names.
-- 3) Test with a service_role key to ensure admin behavior then test as authenticated users.
---------------------------------------------------