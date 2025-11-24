-- Create or replace function is_staff_escola as provided (plpgsql)
CREATE OR REPLACE FUNCTION public.is_staff_escola(escola_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role public.user_role;
  v_escola_id uuid;
  v_current_escola_id uuid;
BEGIN
  -- se não tiver escola, nem continua
  IF escola_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- pega o perfil do usuário logado
  SELECT role, escola_id, current_escola_id
  INTO v_role, v_escola_id, v_current_escola_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- super_admin / global_admin enxergam tudo
  IF v_role IN ('super_admin', 'global_admin') THEN
    RETURN TRUE;
  END IF;

  -- staff “local” da escola
  IF v_role IN ('admin', 'secretaria', 'financeiro', 'professor')
     AND (v_escola_id = escola_uuid OR v_current_escola_id = escola_uuid)
  THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Revoke execute from public/anon/authenticated for safety
REVOKE EXECUTE ON FUNCTION public.is_staff_escola(uuid) FROM public, authenticated, anon;

-- Enable RLS on public.alunos
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Drop old/conflicting policies if they exist
DROP POLICY IF EXISTS alunos_select_staff ON public.alunos;
DROP POLICY IF EXISTS alunos_select_por_escola_ou_proprio ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_por_escola_ou_proprio" ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_by_scope" ON public.alunos;
DROP POLICY IF EXISTS alunos_select_proprio ON public.alunos;  -- 

-- Create staff select policy
CREATE POLICY alunos_select_staff
ON public.alunos
FOR SELECT
TO authenticated
USING (
  public.is_staff_escola(escola_id)
);

-- Create own-student select policy
CREATE POLICY alunos_select_proprio
ON public.alunos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_id = public.alunos.profile_id
  )
);
