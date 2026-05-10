-- Migration: 20260510000002_outbox_recibo_pagamento_auto.sql
-- Objetivo: Enfileirar emissão automática de recibo quando pagamento é liquidado.

BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_pagamento_recibo_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NEW.escola_id IS NOT NULL
    AND NEW.aluno_id IS NOT NULL
    AND COALESCE(NEW.valor_pago, 0) > 0
    AND NEW.status IN ('settled', 'concluido')
    AND (
      TG_OP = 'INSERT'
      OR COALESCE(OLD.status, '') NOT IN ('settled', 'concluido')
    )
  THEN
    INSERT INTO public.outbox_events (
      escola_id,
      event_type,
      dedupe_key,
      idempotency_key,
      payload,
      tenant_scope
    )
    VALUES (
      NEW.escola_id,
      'financeiro_recibo_pagamento',
      'pagamento_recibo:' || NEW.id::text,
      'pagamento_recibo:' || NEW.id::text,
      jsonb_build_object(
        'pagamento_id', NEW.id,
        'mensalidade_id', NEW.mensalidade_id,
        'aluno_id', NEW.aluno_id,
        'valor_pago', NEW.valor_pago,
        'data_pagamento', NEW.data_pagamento,
        'metodo', NEW.metodo,
        'reference', NEW.reference
      ),
      'escola:' || NEW.escola_id::text
    )
    ON CONFLICT (escola_id, dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagamentos_recibo_outbox_insert_update ON public.pagamentos;
CREATE TRIGGER pagamentos_recibo_outbox_insert_update
AFTER INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_pagamento_recibo_outbox();

COMMIT;
