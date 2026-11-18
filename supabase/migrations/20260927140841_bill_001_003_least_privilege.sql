BEGIN;

-- Final least-privilege pass for BILL-001/BILL-002/BILL-003.
-- Immutable fiscal data is written only through SECURITY DEFINER RPCs owned by postgres.
REVOKE ALL ON TABLE public.fiscal_documentos FROM anon;
REVOKE ALL ON TABLE public.fiscal_documento_itens FROM anon;
REVOKE ALL ON TABLE public.fiscal_documentos_eventos FROM anon;
REVOKE ALL ON TABLE public.fiscal_series FROM anon;
REVOKE ALL ON TABLE public.fiscal_series_requests FROM anon;

GRANT SELECT ON TABLE public.fiscal_documentos TO authenticated;
GRANT SELECT ON TABLE public.fiscal_documento_itens TO authenticated;
GRANT SELECT ON TABLE public.fiscal_documentos_eventos TO authenticated;
GRANT SELECT ON TABLE public.fiscal_series TO authenticated;
GRANT SELECT ON TABLE public.fiscal_series_requests TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.fiscal_documentos
  FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.fiscal_documento_itens
  FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.fiscal_documentos_eventos
  FROM service_role;

-- AGT provisioning runtime needs to create series, but it must not mutate or
-- destroy an existing fiscal series directly.
REVOKE UPDATE, DELETE, TRUNCATE
  ON TABLE public.fiscal_series
  FROM service_role;
GRANT SELECT, INSERT
  ON TABLE public.fiscal_series
  TO service_role;

-- Request ledger is mutable only for its status lifecycle.
REVOKE DELETE, TRUNCATE
  ON TABLE public.fiscal_series_requests
  FROM service_role;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.fiscal_series_requests
  TO service_role;

COMMIT;
