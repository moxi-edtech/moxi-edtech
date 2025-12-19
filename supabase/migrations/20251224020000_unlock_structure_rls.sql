-- =========================================================
-- DESBLOQUEIO DE ESTRUTURA (CURSOS, CLASSES, DISCIPLINAS)
-- Permite que Super Admin e Admin da Escola criem o currículo
-- =========================================================

-- 1. Garantir RLS ativo
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o usuário é Admin da Escola atual
create or replace function public.is_admin_escola()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_escola_admin(public.current_tenant_escola_id());
$$;

grant execute on function public.is_admin_escola() to anon, authenticated, service_role;

-- =========================================================
-- TABELA: CURSOS
-- =========================================================

-- LEITURA: Todo o staff e alunos precisam ver os cursos
DROP POLICY IF EXISTS "Ver Cursos" ON public.cursos;
CREATE POLICY "Ver Cursos" ON public.cursos
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR 
  escola_id = public.current_tenant_escola_id()
);

-- ESCRITA: Super Admin (Você) + Admin da Escola
DROP POLICY IF EXISTS "Gerir Cursos" ON public.cursos;
CREATE POLICY "Gerir Cursos" ON public.cursos
FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
)
WITH CHECK (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
);

-- =========================================================
-- TABELA: CLASSES (Onde deu o erro 403 no log)
-- =========================================================

-- LEITURA
DROP POLICY IF EXISTS "Ver Classes" ON public.classes;
CREATE POLICY "Ver Classes" ON public.classes
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR 
  escola_id = public.current_tenant_escola_id()
);

-- ESCRITA
DROP POLICY IF EXISTS "Gerir Classes" ON public.classes;
CREATE POLICY "Gerir Classes" ON public.classes
FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
)
WITH CHECK (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
);

-- =========================================================
-- TABELA: DISCIPLINAS
-- =========================================================

-- LEITURA
DROP POLICY IF EXISTS "Ver Disciplinas" ON public.disciplinas;
CREATE POLICY "Ver Disciplinas" ON public.disciplinas
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR 
  escola_id = public.current_tenant_escola_id()
);

-- ESCRITA
DROP POLICY IF EXISTS "Gerir Disciplinas" ON public.disciplinas;
CREATE POLICY "Gerir Disciplinas" ON public.disciplinas
FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
)
WITH CHECK (
  public.is_super_admin()
  OR 
  (
    escola_id = public.current_tenant_escola_id()
    AND 
    public.is_admin_escola()
  )
);
