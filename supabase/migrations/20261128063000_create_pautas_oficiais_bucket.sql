BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pautas_oficiais_fechadas', 'pautas_oficiais_fechadas', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS pautas_oficiais_select ON storage.objects;
CREATE POLICY pautas_oficiais_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pautas_oficiais_fechadas'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pautas_oficiais_insert ON storage.objects;
CREATE POLICY pautas_oficiais_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pautas_oficiais_fechadas'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pautas_oficiais_update ON storage.objects;
CREATE POLICY pautas_oficiais_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pautas_oficiais_fechadas'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'pautas_oficiais_fechadas'
    AND (storage.foldername(name))[1] IN (
      SELECT eu.escola_id::text
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
    )
  );

COMMIT;
