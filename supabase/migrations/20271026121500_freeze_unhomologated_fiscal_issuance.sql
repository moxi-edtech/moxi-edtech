-- Fiscal engine activation freeze: pending formal AGT homologation.
-- This is NOT the school's operational receipt system (documentos_emitidos).
-- Lock down fiscal_documentos emission from both authenticated clients
-- and application service-role workers, including direct RPC calls.
-- DO NOT re-grant these permissions without homologation and explicit release.
REVOKE EXECUTE ON FUNCTION public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, date, text, jsonb,
  uuid, uuid, numeric, jsonb, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_emitir_recibo_pagamento(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_finalizar_assinatura(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
