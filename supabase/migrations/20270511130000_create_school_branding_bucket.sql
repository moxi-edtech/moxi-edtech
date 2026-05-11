INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-branding',
  'school-branding',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS school_branding_select ON storage.objects;
CREATE POLICY school_branding_select
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'school-branding');

DROP POLICY IF EXISTS school_branding_insert ON storage.objects;
CREATE POLICY school_branding_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'school-branding'
  AND split_part(name, '/', 1) = 'escolas'
  AND user_has_role_in_school(
    split_part(name, '/', 2)::uuid,
    ARRAY['admin', 'admin_escola', 'secretaria']
  )
);

DROP POLICY IF EXISTS school_branding_update ON storage.objects;
CREATE POLICY school_branding_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'school-branding'
  AND split_part(name, '/', 1) = 'escolas'
  AND user_has_role_in_school(
    split_part(name, '/', 2)::uuid,
    ARRAY['admin', 'admin_escola', 'secretaria']
  )
)
WITH CHECK (
  bucket_id = 'school-branding'
  AND split_part(name, '/', 1) = 'escolas'
  AND user_has_role_in_school(
    split_part(name, '/', 2)::uuid,
    ARRAY['admin', 'admin_escola', 'secretaria']
  )
);

DROP POLICY IF EXISTS school_branding_delete ON storage.objects;
CREATE POLICY school_branding_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'school-branding'
  AND split_part(name, '/', 1) = 'escolas'
  AND user_has_role_in_school(
    split_part(name, '/', 2)::uuid,
    ARRAY['admin', 'admin_escola', 'secretaria']
  )
);
