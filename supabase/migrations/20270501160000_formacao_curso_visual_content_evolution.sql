-- Migration: Add course learning outcomes, requirements and assets bucket
-- Date: 01/05/2026

BEGIN;

-- 1. Create formacao-assets bucket for course thumbnails and materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'formacao-assets', 
    'formacao-assets', 
    true, 
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS for formacao-assets
DROP POLICY IF EXISTS "Public View Assets" ON storage.objects;
CREATE POLICY "Public View Assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'formacao-assets');

DROP POLICY IF EXISTS "Authenticated Upload Assets" ON storage.objects;
CREATE POLICY "Authenticated Upload Assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'formacao-assets');

DROP POLICY IF EXISTS "Gestores Manage Assets" ON storage.objects;
CREATE POLICY "Gestores Manage Assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'formacao-assets' 
    AND (storage.foldername(name))[1] IN (
        SELECT escola_id::text FROM public.escola_users WHERE user_id = auth.uid()
    )
);

-- 2. Add learning outcomes and requirements to formacao_cursos
ALTER TABLE public.formacao_cursos 
ADD COLUMN IF NOT EXISTS objetivos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS requisitos jsonb DEFAULT '[]'::jsonb;

COMMIT;
