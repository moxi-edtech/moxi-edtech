UPDATE public.modelos_avaliacao
SET formula = jsonb_build_object(
  'componentes', componentes,
  'tipo', tipo,
  'regras', regras
)
WHERE formula IS NULL
   OR formula = '{}'::jsonb;
