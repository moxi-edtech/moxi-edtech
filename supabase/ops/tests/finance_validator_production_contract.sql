-- Synthetic contract only: production validator, simplified monthly allocation seam.
-- No production data or credentials.
CREATE TABLE public.financeiro_pagamento_alocacoes (
 pagamento_id uuid NOT NULL, mensalidade_id uuid NOT NULL,
 PRIMARY KEY(pagamento_id,mensalidade_id)
);
CREATE OR REPLACE FUNCTION public.financeiro_aplicar_pagamento_existente(
 p_pagamento_id uuid,p_actor_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE p public.pagamentos%ROWTYPE; m public.mensalidades%ROWTYPE; applied integer;
BEGIN
 SELECT * INTO p FROM public.pagamentos WHERE id=p_pagamento_id FOR UPDATE;
 IF p.status <> 'settled' THEN RAISE EXCEPTION 'STATE: payment not settled'; END IF;
 SELECT * INTO m FROM public.mensalidades WHERE id=p.mensalidade_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.financeiro_pagamento_alocacoes WHERE pagamento_id=p.id AND mensalidade_id=m.id) THEN
   RETURN jsonb_build_object('ok',true,'idempotent',true,'mensalidade_status',m.status);
 END IF;
 IF p.valor_pago <= 0 OR m.valor_pago_total + p.valor_pago > m.valor + 0.01 THEN
   RAISE EXCEPTION 'STATE: saldo da mensalidade insuficiente';
 END IF;
 INSERT INTO public.financeiro_pagamento_alocacoes VALUES(p.id,m.id);
 UPDATE public.mensalidades SET valor_pago_total=m.valor_pago_total+p.valor_pago,
 status=CASE WHEN m.valor_pago_total+p.valor_pago>=m.valor THEN 'pago' ELSE 'pago_parcial' END
 WHERE id=m.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'mensalidade_status',
 CASE WHEN m.valor_pago_total+p.valor_pago>=m.valor THEN 'pago' ELSE 'pago_parcial' END);
END $$;
-- Baseline is read from live pg_get_functiondef and loaded before migration.
