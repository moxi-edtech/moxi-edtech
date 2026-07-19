DROP POLICY IF EXISTS formacao_leads_insert_anon ON public.formacao_leads;
CREATE POLICY formacao_leads_insert_anon
ON public.formacao_leads
FOR INSERT TO anon, authenticated
WITH CHECK (
  btrim(nome) <> ''
  AND length(nome) <= 200
  AND (
    (email IS NOT NULL AND btrim(email) <> '' AND length(email) <= 320)
    OR (telefone IS NOT NULL AND btrim(telefone) <> '' AND length(telefone) <= 50)
  )
  AND (origem IS NULL OR length(origem) <= 100)
  AND (turno_preferencia IS NULL OR length(turno_preferencia) <= 100)
  AND (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);
