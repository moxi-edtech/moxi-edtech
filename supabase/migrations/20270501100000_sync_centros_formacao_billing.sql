-- Migration: sync_centros_formacao_billing
-- Mantém o estado da subscrição do centro de formação sincronizado com a tabela de assinaturas SaaS.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_centro_formacao_status_from_assinatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se a assinatura for activada, actualizamos o centro de formação para 'active'
  IF NEW.status = 'activa' THEN
    UPDATE public.centros_formacao
    SET subscription_status = 'active',
        subscription_updated_at = now(),
        updated_at = now()
    WHERE escola_id = NEW.escola_id;
  
  -- Se a assinatura for suspensa ou cancelada, e não houver outra activa, actualizamos para o estado correspondente
  ELSIF NEW.status IN ('suspensa', 'cancelada') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.assinaturas 
      WHERE escola_id = NEW.escola_id 
      AND status = 'activa' 
      AND id <> NEW.id
    ) THEN
      UPDATE public.centros_formacao
      SET subscription_status = CASE WHEN NEW.status = 'suspensa' THEN 'past_due' ELSE 'expired' END,
          subscription_updated_at = now(),
          updated_at = now()
      WHERE escola_id = NEW.escola_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_centro_formacao_status ON public.assinaturas;
CREATE TRIGGER trg_sync_centro_formacao_status
AFTER INSERT OR UPDATE OF status
ON public.assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.sync_centro_formacao_status_from_assinatura();

-- Backfill: Sincronizar estados actuais
UPDATE public.centros_formacao cf
SET subscription_status = 'active',
    subscription_updated_at = now()
FROM public.assinaturas a
WHERE cf.escola_id = a.escola_id
  AND a.status = 'activa'
  AND cf.subscription_status <> 'active';

COMMIT;
