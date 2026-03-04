CREATE OR REPLACE FUNCTION public.calcular_media_trimestral(
  p_notas jsonb,
  p_regras jsonb
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tipo text;
  v_chaves jsonb;
  v_pesos jsonb;
  v_chave text;
  v_soma numeric := 0;
  v_soma_pesos numeric := 0;
  v_nota numeric;
  v_peso numeric;
  v_count int := 0;
BEGIN
  IF p_notas IS NULL OR p_regras IS NULL THEN
    RETURN NULL;
  END IF;

  v_tipo := p_regras->>'tipo';
  v_chaves := p_regras->'mt_formula';
  v_pesos := p_regras->'pesos';

  IF v_tipo = 'aritmetica_simples' THEN
    FOR v_chave IN SELECT jsonb_array_elements_text(v_chaves)
    LOOP
      v_nota := (p_notas->>v_chave)::numeric;

      IF v_nota IS NOT NULL THEN
        v_soma := v_soma + v_nota;
        v_count := v_count + 1;
      END IF;
    END LOOP;

    IF v_count = 0 THEN
      RETURN NULL;
    END IF;

    RETURN ROUND(v_soma / v_count, 0);
  ELSIF v_tipo = 'ponderada' THEN
    FOR v_chave IN SELECT jsonb_array_elements_text(v_chaves)
    LOOP
      v_nota := (p_notas->>v_chave)::numeric;
      v_peso := (v_pesos->>v_chave)::numeric;

      IF v_nota IS NOT NULL AND v_peso IS NOT NULL THEN
        v_soma := v_soma + (v_nota * v_peso);
        v_soma_pesos := v_soma_pesos + v_peso;
      END IF;
    END LOOP;

    IF v_soma_pesos = 0 THEN
      RETURN NULL;
    END IF;

    RETURN ROUND(v_soma / v_soma_pesos, 0);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;
