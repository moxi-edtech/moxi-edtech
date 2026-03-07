BEGIN;

CREATE OR REPLACE FUNCTION public.sync_escola_plano_from_assinatura(
  p_escola_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plano public.app_plan_tier;
BEGIN
  SELECT a.plano
    INTO v_plano
  FROM public.assinaturas a
  WHERE a.escola_id = p_escola_id
    AND a.status = 'activa'
  ORDER BY a.data_inicio DESC, a.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_plano IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.escolas
  SET plano_atual = v_plano,
      updated_at = now()
  WHERE id = p_escola_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_escola_plano_from_assinatura()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'activa' THEN
    UPDATE public.escolas
    SET plano_atual = NEW.plano,
        updated_at = now()
    WHERE id = NEW.escola_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'activa' AND NEW.status IS DISTINCT FROM 'activa' THEN
    PERFORM public.sync_escola_plano_from_assinatura(NEW.escola_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_escola_plano_from_assinatura ON public.assinaturas;
CREATE TRIGGER trg_sync_escola_plano_from_assinatura
AFTER INSERT OR UPDATE OF plano, status
ON public.assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_escola_plano_from_assinatura();

WITH latest AS (
  SELECT DISTINCT ON (a.escola_id)
    a.escola_id,
    a.plano
  FROM public.assinaturas a
  WHERE a.status = 'activa'
  ORDER BY a.escola_id, a.data_inicio DESC, a.updated_at DESC NULLS LAST
)
UPDATE public.escolas e
SET plano_atual = latest.plano,
    updated_at = now()
FROM latest
WHERE e.id = latest.escola_id;

COMMIT;
