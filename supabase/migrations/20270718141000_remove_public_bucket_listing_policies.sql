-- Public object URLs do not require broad SELECT policies on storage.objects.
DROP POLICY IF EXISTS "Public View Assets" ON storage.objects;
DROP POLICY IF EXISTS "Public View Comprovativos" ON storage.objects;
DROP POLICY IF EXISTS school_branding_select ON storage.objects;
