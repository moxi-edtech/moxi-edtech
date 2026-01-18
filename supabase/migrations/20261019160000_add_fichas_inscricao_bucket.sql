-- Migration: Add fichas-inscricao storage bucket and policies
-- Created at: 2026-10-19 16:00:00

BEGIN;

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fichas-inscricao', 
  'fichas-inscricao', 
  false, 
  5242880, -- 5MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to ensure clean state (optional but safer for idempotency)
DROP POLICY IF EXISTS "Fichas Inscricao Select Policy" ON storage.objects;
DROP POLICY IF EXISTS "Fichas Inscricao Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Fichas Inscricao Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Fichas Inscricao Delete Policy" ON storage.objects;

-- 3. Create RLS Policies

-- Policy helper: Check if user belongs to the school in the path prefix (escola_id/...)
-- Assumes path format: "{escola_id}/{filename}"
-- and assumes public.get_my_escola_ids() returns the user's schools.

-- SELECT: Allow read if user is member of the school
CREATE POLICY "Fichas Inscricao Select Policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fichas-inscricao' 
  AND (
    (storage.foldername(name))[1]::uuid = ANY (public.get_my_escola_ids())
  )
);

-- INSERT: Allow upload if user is member of the school
CREATE POLICY "Fichas Inscricao Insert Policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fichas-inscricao' 
  AND (
    (storage.foldername(name))[1]::uuid = ANY (public.get_my_escola_ids())
  )
);

-- UPDATE: Allow update if user is member of the school (e.g. replacing the file)
CREATE POLICY "Fichas Inscricao Update Policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fichas-inscricao' 
  AND (
    (storage.foldername(name))[1]::uuid = ANY (public.get_my_escola_ids())
  )
)
WITH CHECK (
  bucket_id = 'fichas-inscricao' 
  AND (
    (storage.foldername(name))[1]::uuid = ANY (public.get_my_escola_ids())
  )
);

-- DELETE: Allow delete if user is member of the school
CREATE POLICY "Fichas Inscricao Delete Policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fichas-inscricao' 
  AND (
    (storage.foldername(name))[1]::uuid = ANY (public.get_my_escola_ids())
  )
);

COMMIT;
