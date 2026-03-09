-- Remove legacy notas_select policy after RLS hardening
DROP POLICY IF EXISTS notas_select ON public.notas;
