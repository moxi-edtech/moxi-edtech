BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  IF current_user <> 'postgres'
     AND NEW.status IN ('settled','concluido','pago','confirmed','paid','succeeded') THEN
    RAISE EXCEPTION
      'IMMUTABILITY: pagamento liquidado deve ser criado/liquidado por RPC canónica';
  END IF;
  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_pagamentos_financial_insert_guard
ON public.pagamentos;

CREATE TRIGGER trg_pagamentos_financial_insert_guard
BEFORE INSERT ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_guard_pagamento_insert();

REVOKE EXECUTE ON FUNCTION public.financeiro_guard_pagamento_insert()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;