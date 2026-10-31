-- KLASSE #308: eliminate table-wide privileges that RLS does not constrain.
-- Preserve CRUD grants, existing RLS policies, triggers and privileged service-role access.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.historico_transitado_anos,
  public.historico_transitado_notas
FROM anon, authenticated;