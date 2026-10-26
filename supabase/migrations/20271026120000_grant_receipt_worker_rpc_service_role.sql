-- Repair the production ACL drift detected on 2026-10-26.
-- The application outbox consumer authenticates as service_role; only this
-- role (and postgres owner) may call the existing privileged receipt RPC.
-- Preserve all fiscal constraints and authenticated-user RPC grants.
GRANT EXECUTE ON FUNCTION public.emitir_recibo_system(uuid) TO service_role;
