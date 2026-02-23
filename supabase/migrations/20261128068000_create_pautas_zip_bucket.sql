BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pautas_zip', 'pautas_zip', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS pautas_zip_select ON storage.objects;
CREATE POLICY pautas_zip_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pautas_zip'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pautas_zip_insert ON storage.objects;
CREATE POLICY pautas_zip_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pautas_zip'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pautas_zip_update ON storage.objects;
CREATE POLICY pautas_zip_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pautas_zip'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'pautas_zip'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.cleanup_pautas_zip()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'pautas_zip'
    AND created_at < now() - interval '7 days';
END;
$$;

SELECT cron.schedule(
  'cleanup_pautas_zip',
  '0 4 * * *',
  $$SELECT public.cleanup_pautas_zip();$$
);

COMMIT;
