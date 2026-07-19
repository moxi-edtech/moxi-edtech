BEGIN;

DO $migration$
DECLARE
  signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.aprovar_fecho_caixa(uuid)'::regprocedure,
    'public.declarar_fecho_caixa(uuid,numeric,numeric,numeric)'::regprocedure,
    'public.estornar_mensalidade(uuid,text)'::regprocedure,
    'public.fiscal_anular_documento(uuid,text,jsonb)'::regprocedure,
    'public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text,text)'::regprocedure,
    'public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text)'::regprocedure,
    'public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,uuid,uuid,date,text,numeric,jsonb,jsonb,text)'::regprocedure,
    'public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,uuid,uuid,date,text,numeric,jsonb,jsonb)'::regprocedure,
    'public.fiscal_finalizar_assinatura(uuid,text,text,text)'::regprocedure,
    'public.fiscal_rectificar_documento(uuid,text,jsonb)'::regprocedure,
    'public.fiscal_reservar_numero_serie(uuid)'::regprocedure,
    'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)'::regprocedure,
    'public.registrar_pagamento(uuid,text,text,numeric,date)'::regprocedure,
    'public.reverter_pagamento_realizado(uuid,text,text)'::regprocedure,
    'public.validar_pagamento(uuid,boolean,text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
