CREATE OR REPLACE FUNCTION public.can_manage_school(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
        AND p.role IN (
          'admin',
          'admin_escola',
          'staff_admin',
          'secretaria',
          'financeiro'
        )
        AND p.deleted_at IS NULL
    );
$$;

DROP POLICY IF EXISTS outbox_events_insert ON public.outbox_events;

CREATE POLICY outbox_events_insert
ON public.outbox_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.user_has_role_in_school(
    escola_id,
    ARRAY[
      'admin',
      'admin_escola',
      'staff_admin',
      'secretaria',
      'secretario',
      'financeiro',
      'formacao_admin',
      'formacao_secretaria'
    ]
  )
);
