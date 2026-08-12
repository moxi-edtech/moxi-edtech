BEGIN;

-- Defence in depth for direct RPC/service-pedido calls. The API also validates
-- this rule before collecting payment, but the database must reject a granted
-- rematricula when the source matrícula still has an open balance.
CREATE OR REPLACE FUNCTION public.prevent_rematricula_grant_with_origin_debt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_open_count integer;
  v_matricula_origem_id uuid;
BEGIN
  IF NEW.servico_codigo = 'SERV_REMATRICULA'
     AND NEW.status = 'granted'
     AND OLD.status IS DISTINCT FROM 'granted' THEN
    v_matricula_origem_id := coalesce(
      nullif(NEW.contexto->>'origem_matricula_id', '')::uuid,
      OLD.matricula_id
    );

    SELECT count(*)
      INTO v_open_count
    FROM public.mensalidades m
    WHERE m.escola_id = NEW.escola_id
      AND m.aluno_id = NEW.aluno_id
      AND m.matricula_id = v_matricula_origem_id
      AND greatest(
        coalesce(m.valor_previsto, m.valor, 0) - coalesce(m.valor_pago_total, 0),
        0
      ) > 0
      AND lower(coalesce(m.status, '')) NOT IN ('pago', 'isento', 'cancelado');

    IF v_open_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
        DETAIL = 'A matrícula de origem possui mensalidades pendentes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_rematricula_grant_with_origin_debt
  ON public.servico_pedidos;

CREATE TRIGGER trg_prevent_rematricula_grant_with_origin_debt
BEFORE UPDATE OF status ON public.servico_pedidos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_rematricula_grant_with_origin_debt();

COMMIT;
