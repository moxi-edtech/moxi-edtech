-- This migration adds Row-Level Security policies for INSERT, UPDATE, and DELETE operations
-- on the `cursos` table, ensuring only authorized staff can modify course data,
-- which fixes the "new row violates row-level security policy" error during curriculum setup.

-- 1. Ensure RLS is enabled on the table. It is idempotent.
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

-- 2. Create the INSERT policy.
-- Allows authenticated staff members to insert new courses for their school.
DROP POLICY IF EXISTS "cursos_insert_staff" ON "public"."cursos";
CREATE POLICY "cursos_insert_staff" ON "public"."cursos"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  public.is_staff_escola(escola_id)
);

-- 3. Create the UPDATE policy.
-- Allows authenticated staff members to update courses for their school.
DROP POLICY IF EXISTS "cursos_update_staff" ON "public"."cursos";
CREATE POLICY "cursos_update_staff" ON "public"."cursos"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (public.is_staff_escola(escola_id))
WITH CHECK (public.is_staff_escola(escola_id));

-- 4. Create the DELETE policy.
-- Allows authenticated staff members to delete courses for their school.
DROP POLICY IF EXISTS "cursos_delete_staff" ON "public"."cursos";
CREATE POLICY "cursos_delete_staff" ON "public"."cursos"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (public.is_staff_escola(escola_id));

-- 5. Create performance indexes to prevent slow queries related to RLS checks,
-- addressing potential high latency on API calls.
CREATE INDEX IF NOT EXISTS idx_escola_users_escola_user
ON public.escola_users (escola_id, user_id);

CREATE INDEX IF NOT EXISTS idx_cursos_escola
ON public.cursos (escola_id);
