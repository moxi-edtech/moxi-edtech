-- Migration: 20270505000001_allow_admin_update_escolas.sql
-- Description: Allows users with 'admin' role in escola_users to update their school's information.

BEGIN;

DROP POLICY IF EXISTS "admin_update_escola_details" ON public.escolas;
CREATE POLICY "admin_update_escola_details"
ON public.escolas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.escola_users
    WHERE escola_id = public.escolas.id
      AND user_id = auth.uid()
      AND papel = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.escola_users
    WHERE escola_id = public.escolas.id
      AND user_id = auth.uid()
      AND papel = 'admin'
  )
);

COMMIT;
