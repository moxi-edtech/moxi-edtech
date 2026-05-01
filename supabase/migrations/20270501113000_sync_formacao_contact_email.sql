BEGIN;

UPDATE public.centros_formacao
SET
  email = lower(nullif(btrim(landing_config #>> '{contactos,email}'), '')),
  telefone = coalesce(nullif(btrim(landing_config #>> '{contactos,telefone}'), ''), telefone),
  morada = coalesce(nullif(btrim(landing_config #>> '{contactos,endereco}'), ''), morada),
  website = coalesce(nullif(btrim(landing_config #>> '{redes_sociais,website}'), ''), website),
  updated_at = now()
WHERE nullif(btrim(landing_config #>> '{contactos,email}'), '') IS NOT NULL
  AND email IS DISTINCT FROM lower(nullif(btrim(landing_config #>> '{contactos,email}'), ''));

COMMIT;
