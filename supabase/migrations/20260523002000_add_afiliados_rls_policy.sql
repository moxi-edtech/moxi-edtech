-- Add RLS policies for afiliados table
BEGIN;

-- Super Admin can do everything on afiliados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'afiliados' 
        AND policyname = 'Super Admin manage affiliates'
    ) THEN
        CREATE POLICY "Super Admin manage affiliates" ON public.afiliados
            FOR ALL USING (public.is_super_admin());
    END IF;
END $$;

-- Public/Anon can't see the whole table, but the get_afiliado_portal function 
-- is SECURITY DEFINER, so it can bypass RLS to validate PIN.

COMMIT;
