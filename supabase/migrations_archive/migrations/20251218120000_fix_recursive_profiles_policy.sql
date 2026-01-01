BEGIN;

-- 1. Função Auxiliar para Quebrar a Recursão (SECURITY DEFINER)
-- Esta função permite ler o escola_id do usuário sem acionar as políticas da tabela profiles.
CREATE OR REPLACE FUNCTION public.get_my_escola_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER -- Roda com permissões de superusuário (bypassa RLS)
SET search_path = public
STABLE
AS $$
  SELECT escola_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 2. Corrigir a Política de Perfis (Profiles)
DROP POLICY IF EXISTS "profiles_select_opt" ON public.profiles;
DROP POLICY IF EXISTS "unified_select_profiles" ON public.profiles; 

CREATE POLICY "profiles_select_unificado_final" ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Regra 1: O próprio usuário vê seu perfil
  user_id = (select auth.uid())
  
  OR
  
  -- Regra 2: Staff vê outros perfis da MESMA escola
  (
    escola_id IS NOT NULL 
    AND 
    escola_id = get_my_escola_id() -- Usa a função segura para evitar o loop!
  )
  
  OR
  
  -- Regra 3: Super Admin vê tudo (usando a função que criamos antes)
  is_super_admin()
);

COMMIT;