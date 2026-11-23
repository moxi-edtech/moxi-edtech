-- CONTRATO (fase 2): executar somente quando a nova API de emissão
-- estiver publicada e validada na Vercel (PR #456), nunca antes.
-- Remover a capacidade de contornar o ledger via RPC antiga, mas preservar
-- o service_role para o wrapper interno da nova emissão.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.documento_individual_acesso(uuid,uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.documento_individual_solicitar(uuid,uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.emitir_documento_final_individual(uuid,uuid,integer,uuid,text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'DOCUMENTOS_CUTOVER_REQUIRES_NEW_API_RPC';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)
  TO service_role;
COMMIT;
