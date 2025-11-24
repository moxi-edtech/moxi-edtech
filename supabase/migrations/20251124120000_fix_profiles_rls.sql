-- Fix RLS policy on profiles to allow staff to see profiles in their school

-- Drop old policy
DROP POLICY IF EXISTS "unified_select_profiles" ON public.profiles;

-- Create new policy that allows staff members to see profiles of users in the same school.
CREATE POLICY "unified_select_profiles" ON "public"."profiles"
FOR SELECT
TO authenticated
USING (
  (public.is_staff_escola(escola_id)) OR (auth.uid() = user_id)
);
