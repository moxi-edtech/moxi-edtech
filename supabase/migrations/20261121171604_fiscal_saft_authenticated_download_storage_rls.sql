-- SEC-002: assinaturas de download SAF-T(AO) devem ser emitidas no contexto
-- do utilizador autenticado, nunca com service_role numa rota humana.
-- O documento fiscal permanece no bucket PRIVADO; somente SELECT,
-- limitado ao objecto exacto de uma exportacao concluida da empresa permitida.
BEGIN;

DROP POLICY IF EXISTS fiscal_saft_authenticated_export_download ON storage.objects;

CREATE POLICY fiscal_saft_authenticated_export_download
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fiscal-saft'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.fiscal_saft_exports AS saft
    WHERE (
      ltrim(saft.arquivo_storage_path, '/') = storage.objects.name
      OR ltrim(saft.arquivo_storage_path, '/') = 'fiscal-saft/' || storage.objects.name
    )
      AND saft.status IN ('generated', 'validated', 'submitted')
      AND public.user_has_role_in_empresa(
        saft.empresa_id,
        ARRAY['owner', 'admin', 'operator']::text[]
      )
  )
);

-- Nao criar politica de upload, actualizacao, DELETE ou acesso anon.
-- A criacao permanece reservada ao worker Inngest com service_role.
-- A RLS de fiscal_saft_exports continua a limitar a leitura da exportacao.
COMMIT;
