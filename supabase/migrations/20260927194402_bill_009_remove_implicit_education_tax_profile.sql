UPDATE public.financeiro_tabelas
SET
  tax_profile_code = NULL,
  updated_at = now()
WHERE tax_profile_code = 'IVA_EDUCACAO_M21';

COMMENT ON COLUMN public.financeiro_tabelas.tax_profile_code IS
  'BILL-009: classificação fiscal opcional do catálogo. Serviços de ensino/mensalidades não herdam M21 automaticamente; o perfil é resolvido server-side a partir do regime IVA e da elegibilidade M21 verificados da empresa fiscal.';

DO $verify$
DECLARE
  v_remaining bigint;
BEGIN
  SELECT count(*)
  INTO v_remaining
  FROM public.financeiro_tabelas
  WHERE tax_profile_code = 'IVA_EDUCACAO_M21';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION
      'BILL-009 cleanup failed: ainda existem % tabelas com M21 implícito',
      v_remaining;
  END IF;
END;
$verify$;
