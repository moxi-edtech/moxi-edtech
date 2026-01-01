CREATE OR REPLACE FUNCTION public.preview_matricula_number(
  p_escola_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last bigint;
  v_init bigint;
BEGIN
  -- 1) Tenta usar o contador oficial, se existir
  SELECT last_value
  INTO v_last
  FROM public.matricula_counters
  WHERE escola_id = p_escola_id;

  -- 2) Se não houver contador ainda, baseia-se no histórico legado
  IF v_last IS NULL THEN
    SELECT COALESCE(
      MAX(
        (regexp_replace(numero_matricula, '[^0-9]', '', 'g'))::bigint
      ),
      0
    )
    INTO v_init
    FROM public.matriculas
    WHERE escola_id = p_escola_id
      AND numero_matricula IS NOT NULL
      -- garante que a string reduzida contenha apenas dígitos
      AND regexp_replace(numero_matricula, '[^0-9]', '', 'g') ~ '^[0-9]+$';

    v_last := v_init;
  END IF;

  -- 2.1) Blindagem extra: se ainda assim vier NULL por algum dado estranho, zera.
  IF v_last IS NULL THEN
    v_last := 0;
  END IF;

  -- 3) Retorna o próximo sugerido sem consumir/alterar estado
  RETURN lpad((v_last + 1)::text, 6, '0');
END;
$$;

-- Permissões: remover execução pública e conceder a authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.preview_matricula_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_matricula_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_matricula_number(uuid) TO service_role;
