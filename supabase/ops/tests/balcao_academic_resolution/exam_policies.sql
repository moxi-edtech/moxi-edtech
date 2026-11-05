-- Existing examination grants and RLS.
DROP POLICY IF EXISTS exame_resultados_tenant ON public.exame_resultados;
DROP POLICY IF EXISTS exame_resultados_read_v2 ON public.exame_resultados;
DROP POLICY IF EXISTS exame_resultados_insert_v2 ON public.exame_resultados;
DROP POLICY IF EXISTS exame_resultados_validate_v2 ON public.exame_resultados;
CREATE POLICY exame_resultados_read_v2 ON public.exame_resultados
 FOR SELECT TO authenticated USING (public.user_can_access_raa_school(escola_id));
CREATE POLICY exame_resultados_insert_v2 ON public.exame_resultados
 FOR INSERT TO authenticated WITH CHECK (
   public.user_can_access_raa_school(escola_id) AND public.user_has_role_in_school(escola_id,
     ARRAY['professor','secretaria','admin','admin_escola','staff_admin','diretor']::text[])
 );
CREATE POLICY exame_resultados_validate_v2 ON public.exame_resultados
 FOR UPDATE TO authenticated USING (
   public.user_can_access_raa_school(escola_id) AND public.user_has_role_in_school(escola_id,
     ARRAY['diretor','admin','admin_escola']::text[])
 ) WITH CHECK (
   public.user_can_access_raa_school(escola_id) AND public.user_has_role_in_school(escola_id,
     ARRAY['diretor','admin','admin_escola']::text[])
 );
REVOKE ALL ON TABLE public.exame_resultados FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.exame_resultados TO authenticated;
GRANT UPDATE (estado, updated_at) ON TABLE public.exame_resultados TO authenticated;
