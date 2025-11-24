-- Grant execute permission on is_staff_escola to authenticated and service_role
-- This is necessary for RLS policies to be able to use the function.

GRANT EXECUTE ON FUNCTION public.is_staff_escola(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_escola(uuid) TO service_role;
