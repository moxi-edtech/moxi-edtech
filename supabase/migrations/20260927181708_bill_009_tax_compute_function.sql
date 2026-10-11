BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_tax_compute_document(
  p_itens jsonb,
  p_invoice_date date,
  p_tipo_documento text,
  p_moeda text,
  p_taxa_cambio_aoa numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $tax$
DECLARE
  v_item jsonb;
  v_profile public.fiscal_tax_profiles%ROWTYPE;
  v_profile_count integer;
  v_profile_code text;
  v_quantidade numeric(18,4);
  v_preco numeric(18,4);
  v_unit_price_base numeric(18,4);
  v_settlement numeric(18,4);
  v_expected_settlement numeric(18,4);
  v_operation_type text;
  v_product_type text;
  v_unit text;
  v_line_net numeric(18,4);
  v_line_tax numeric(18,4);
  v_line_gross numeric(18,4);
  v_line_net_aoa numeric(18,4);
  v_line_tax_aoa numeric(18,4);
  v_line_gross_aoa numeric(18,4);
  v_exchange numeric(18,8);
  v_items jsonb := '[]'::jsonb;
  v_net numeric(18,4) := 0;
  v_tax numeric(18,4) := 0;
  v_gross numeric(18,4) := 0;
  v_net_aoa numeric(18,4) := 0;
  v_tax_aoa numeric(18,4) := 0;
  v_gross_aoa numeric(18,4) := 0;
  v_explicit text;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens)=0 THEN
    RAISE EXCEPTION 'DATA: itens tributários obrigatórios';
  END IF;

  v_exchange := CASE
    WHEN upper(p_moeda)='AOA' THEN 1
    ELSE p_taxa_cambio_aoa
  END;

  IF v_exchange IS NULL OR v_exchange <= 0 THEN
    RAISE EXCEPTION 'DATA: taxa de câmbio inválida';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_profile_code := nullif(btrim(coalesce(v_item->>'tax_profile_code','')), '');
    IF v_profile_code IS NULL THEN
      RAISE EXCEPTION 'DATA: tax_profile_code obrigatório em todos os itens';
    END IF;

    SELECT count(*)
      INTO v_profile_count
    FROM public.fiscal_tax_profiles p
    WHERE p.code=v_profile_code
      AND p.valid_from <= p_invoice_date
      AND (p.valid_to IS NULL OR p.valid_to >= p_invoice_date);

    IF v_profile_count <> 1 THEN
      RAISE EXCEPTION
        'DATA: perfil tributário % não possui exactamente uma versão válida em %',
        v_profile_code,p_invoice_date;
    END IF;

    SELECT *
      INTO v_profile
    FROM public.fiscal_tax_profiles p
    WHERE p.code=v_profile_code
      AND p.valid_from <= p_invoice_date
      AND (p.valid_to IS NULL OR p.valid_to >= p_invoice_date)
    ORDER BY p.version DESC
    LIMIT 1;

    v_quantidade := (v_item->>'quantidade')::numeric(18,4);
    v_preco := (v_item->>'preco_unit')::numeric(18,4);
    v_settlement := coalesce(nullif(v_item->>'settlement_amount','')::numeric,0)::numeric(18,4);

    IF v_quantidade <= 0 OR v_preco < 0 OR v_settlement < 0 THEN
      RAISE EXCEPTION 'DATA: quantidade/preço/desconto inválido';
    END IF;

    v_unit_price_base := coalesce(
      nullif(v_item->>'unit_price_base','')::numeric,
      v_preco + CASE WHEN v_quantidade=0 THEN 0 ELSE v_settlement/v_quantidade END
    )::numeric(18,4);

    IF v_unit_price_base + 0.0001 < v_preco THEN
      RAISE EXCEPTION 'DATA: unit_price_base inferior ao preço líquido';
    END IF;

    v_expected_settlement :=
      round((v_quantidade * (v_unit_price_base-v_preco))::numeric,2);

    IF abs(v_expected_settlement-round(v_settlement,2)) > 0.01 THEN
      RAISE EXCEPTION
        'DATA: settlementAmount (%) diverge de quantity*(unitPriceBase-unitPrice) (%)',
        v_settlement,v_expected_settlement;
    END IF;

    v_operation_type := upper(nullif(btrim(coalesce(v_item->>'operation_type','')), ''));
    IF v_operation_type IS NULL THEN
      v_operation_type := coalesce(v_profile.operation_type,'SG');
    END IF;

    IF v_operation_type NOT IN ('SE','SS','STP','SR','SIF','SHS','ST','SG','TB','AS','QT','RD') THEN
      RAISE EXCEPTION 'DATA: operation_type inválido: %',v_operation_type;
    END IF;

    IF v_profile.operation_type IS NOT NULL
       AND v_operation_type IS DISTINCT FROM v_profile.operation_type THEN
      RAISE EXCEPTION
        'DATA: operation_type % incompatível com perfil % (%)',
        v_operation_type,v_profile.code,v_profile.operation_type;
    END IF;

    v_product_type := upper(coalesce(nullif(btrim(v_item->>'product_type'),''),'S'));
    IF v_product_type NOT IN ('P','S','O','E','I') THEN
      RAISE EXCEPTION 'DATA: product_type inválido';
    END IF;

    v_unit := coalesce(nullif(btrim(v_item->>'unit_of_measure'),''),'UN');
    IF length(v_unit)>20 THEN
      RAISE EXCEPTION 'DATA: unit_of_measure excede 20 caracteres';
    END IF;

    v_explicit := nullif(upper(btrim(coalesce(v_item->>'tax_code',''))),'');
    IF v_explicit IS NOT NULL AND v_explicit IS DISTINCT FROM v_profile.tax_code THEN
      RAISE EXCEPTION
        'DATA: tax_code % diverge do perfil tributário % (%)',
        v_explicit,v_profile.code,v_profile.tax_code;
    END IF;

    IF v_item ? 'taxa_iva'
       AND abs((v_item->>'taxa_iva')::numeric-v_profile.tax_percentage)>0.0001 THEN
      RAISE EXCEPTION
        'DATA: taxa_iva % diverge do perfil tributário % (%)',
        v_item->>'taxa_iva',v_profile.code,v_profile.tax_percentage;
    END IF;

    IF v_profile.tax_code='ISE' THEN
      IF v_profile.exemption_code IS NULL OR v_profile.exemption_reason IS NULL THEN
        RAISE EXCEPTION 'STATE: perfil isento sem código/motivo';
      END IF;
      IF nullif(btrim(coalesce(v_item->>'tax_exemption_code','')),'') IS NOT NULL
         AND btrim(v_item->>'tax_exemption_code') IS DISTINCT FROM v_profile.exemption_code THEN
        RAISE EXCEPTION 'DATA: código de isenção diverge do perfil tributário';
      END IF;
    ELSE
      IF nullif(btrim(coalesce(v_item->>'tax_exemption_code','')),'') IS NOT NULL THEN
        RAISE EXCEPTION 'DATA: perfil tributável não aceita tax_exemption_code';
      END IF;
    END IF;

    IF upper(p_tipo_documento)='NC' THEN
      v_line_net := public.fiscal_tax_ceil_cent(v_quantidade*v_preco);
    ELSE
      v_line_net := public.fiscal_tax_trunc_cent(v_quantidade*v_preco);
    END IF;

    IF v_profile.tax_type='IVA' THEN
      v_line_tax := public.fiscal_tax_ceil_cent(
        (v_quantidade*v_preco)*v_profile.tax_percentage/100
      );
    ELSE
      RAISE EXCEPTION
        'STATE: motor BILL-009 ainda não implementa cálculo de %% fora de IVA';
    END IF;

    v_line_gross := round(v_line_net+v_line_tax,2);

    IF upper(p_moeda)='AOA' THEN
      v_line_net_aoa := v_line_net;
      v_line_tax_aoa := v_line_tax;
      v_line_gross_aoa := v_line_gross;
    ELSE
      v_line_net_aoa := round(v_line_net*v_exchange,4);
      v_line_tax_aoa := round(v_line_tax*v_exchange,4);
      v_line_gross_aoa := round(v_line_gross*v_exchange,4);
    END IF;

    v_net := v_net+v_line_net;
    v_tax := v_tax+v_line_tax;
    v_gross := v_gross+v_line_gross;
    v_net_aoa := v_net_aoa+v_line_net_aoa;
    v_tax_aoa := v_tax_aoa+v_line_tax_aoa;
    v_gross_aoa := v_gross_aoa+v_line_gross_aoa;

    v_items := v_items || jsonb_build_array(
      v_item ||
      jsonb_build_object(
        'tax_profile_code',v_profile.code,
        'tax_profile_version',v_profile.version,
        'tax_type',v_profile.tax_type,
        'tax_code',v_profile.tax_code,
        'tax_country_region',v_profile.tax_country_region,
        'taxa_iva',v_profile.tax_percentage,
        'tax_exemption_code',v_profile.exemption_code,
        'tax_exemption_reason',v_profile.exemption_reason,
        'operation_type',v_operation_type,
        'product_type',v_product_type,
        'unit_of_measure',v_unit,
        'unit_price_base',v_unit_price_base,
        'settlement_amount',v_settlement,
        'total_liquido_moeda',v_line_net,
        'total_impostos_moeda',v_line_tax,
        'total_bruto_moeda',v_line_gross,
        'total_liquido_aoa',v_line_net_aoa,
        'total_impostos_aoa',v_line_tax_aoa,
        'total_bruto_aoa',v_line_gross_aoa
      )
    );
  END LOOP;

  IF upper(p_moeda)<>'AOA' THEN
    v_net_aoa := round(v_net*v_exchange,2);
    v_tax_aoa := round(v_tax*v_exchange,2);
    v_gross_aoa := round(v_gross*v_exchange,2);
  ELSE
    v_net_aoa := round(v_net,2);
    v_tax_aoa := round(v_tax,2);
    v_gross_aoa := round(v_gross,2);
  END IF;

  RETURN jsonb_build_object(
    'itens',v_items,
    'total_liquido_moeda',round(v_net,2),
    'total_impostos_moeda',round(v_tax,2),
    'total_bruto_moeda',round(v_gross,2),
    'total_liquido_aoa',v_net_aoa,
    'total_impostos_aoa',v_tax_aoa,
    'total_bruto_aoa',v_gross_aoa
  );
END;
$tax$;

REVOKE EXECUTE ON FUNCTION public.fiscal_tax_compute_document(jsonb,date,text,text,numeric)
FROM PUBLIC,anon,authenticated,service_role;

COMMIT;