ALTER POLICY formacao_funnel_eventos_insert_authenticated
ON public.formacao_funnel_eventos
WITH CHECK (
  app = 'formacao'
  AND btrim(event) <> '' AND length(event) <= 100
  AND (path IS NULL OR length(path) <= 2048)
  AND (source IS NULL OR length(source) <= 200)
  AND (tenant_slug IS NULL OR length(tenant_slug) <= 200)
  AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  AND jsonb_typeof(details) = 'object'
);
