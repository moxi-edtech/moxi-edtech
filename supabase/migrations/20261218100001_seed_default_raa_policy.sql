BEGIN;

-- Toda escola K12 precisa de uma política materializada para que o RAA
-- consiga resolver a progressão sem depender de uma visita ao ecrã de configuração.
INSERT INTO public.configuracoes_pedagogicas (escola_id)
SELECT e.id
FROM public.escolas e
WHERE e.tenant_type = 'k12'
ON CONFLICT (escola_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_default_raa_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_type = 'k12' THEN
    INSERT INTO public.configuracoes_pedagogicas (escola_id)
    VALUES (NEW.id)
    ON CONFLICT (escola_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escolas_default_raa_policy ON public.escolas;

CREATE TRIGGER trg_escolas_default_raa_policy
AFTER INSERT ON public.escolas
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_raa_policy();

COMMIT;
