-- Sessions and components were previously editable/deletable by any school member.
DROP POLICY IF EXISTS exame_sessoes_tenant ON public.exame_sessoes;
DROP POLICY IF EXISTS exame_componentes_tenant ON public.exame_componentes;
CREATE POLICY exame_sessoes_read_v2 ON public.exame_sessoes
  FOR SELECT TO authenticated USING (public.user_can_access_raa_school(escola_id));
CREATE POLICY exame_sessoes_insert_v2 ON public.exame_sessoes
  FOR INSERT TO authenticated WITH CHECK (public.user_can_access_raa_school(escola_id)
  AND public.user_has_role_in_school(escola_id, ARRAY['professor','secretaria','admin','admin_escola','staff_admin','diretor']::text[])
  AND created_by = (SELECT auth.uid()));
CREATE POLICY exame_sessoes_manage_v2 ON public.exame_sessoes
  FOR UPDATE TO authenticated USING (public.user_can_access_raa_school(escola_id)
  AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','diretor']::text[]))
  WITH CHECK (public.user_can_access_raa_school(escola_id)
  AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','diretor']::text[]));
REVOKE ALL ON TABLE public.exame_sessoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.exame_sessoes TO authenticated;
GRANT UPDATE (estado, observacoes, updated_at) ON TABLE public.exame_sessoes TO authenticated;

CREATE POLICY exame_componentes_read_v2 ON public.exame_componentes
  FOR SELECT TO authenticated USING (public.user_can_access_raa_school(escola_id));
CREATE POLICY exame_componentes_insert_v2 ON public.exame_componentes
  FOR INSERT TO authenticated WITH CHECK (public.user_can_access_raa_school(escola_id)
  AND public.user_has_role_in_school(escola_id, ARRAY['professor','secretaria','admin','admin_escola','staff_admin','diretor']::text[])
  AND EXISTS (SELECT 1 FROM public.exame_sessoes s
      WHERE s.id=exame_componentes.exame_sessao_id AND s.escola_id=exame_componentes.escola_id));
REVOKE ALL ON TABLE public.exame_componentes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.exame_componentes TO authenticated;
