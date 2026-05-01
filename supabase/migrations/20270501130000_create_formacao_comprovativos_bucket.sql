-- Migration: Create formacao-comprovativos bucket and policies
-- Data: 01/05/2026 (Reflected as 2027 in migration sequence)

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'formacao-comprovativos', 
    'formacao-comprovativos', 
    true, 
    5242880, -- 5MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 1. Policy for Public/Anon Upload (Inscrições na Landing Page)
DROP POLICY IF EXISTS "Public Upload Comprovativos" ON storage.objects;
CREATE POLICY "Public Upload Comprovativos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'formacao-comprovativos');

-- 2. Policy for Viewing (Public access)
DROP POLICY IF EXISTS "Public View Comprovativos" ON storage.objects;
CREATE POLICY "Public View Comprovativos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'formacao-comprovativos');

-- 3. Policy for Delete/Update (Gestores e Secretaria)
DROP POLICY IF EXISTS "Gestores Delete Comprovativos" ON storage.objects;
CREATE POLICY "Gestores Delete Comprovativos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'formacao-comprovativos' 
    AND (storage.foldername(name))[1] IN (
        SELECT escola_id::text FROM public.escola_users WHERE user_id = auth.uid()
    )
);

COMMIT;
