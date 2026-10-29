-- RAA Balcão: authorization must be enforced in Postgres, not only API handlers.
-- Stacked after persisted-status contract v3; do not apply before #296.
-- No historical data rewrite, no financial/fiscal objects.
BEGIN;

ALTER TABLE public.raa_indisciplina_eventos
  ADD COLUMN IF NOT EXISTS decisao_motivo text;

DROP POLICY IF EXISTS raa_indisciplina_eventos_school_access ON public.raa_indisciplina_eventos;
DROP POLICY IF EXISTS raa_indisciplina_school_read_v2 ON public.raa_indisciplina_eventos;
DROP POLICY IF EXISTS raa_indisciplina_school_insert_v2 ON public.raa_indisciplina_eventos;
DROP POLICY IF EXISTS raa_indisciplina_director_update_v2 ON public.raa_indisciplina_eventos;

CREATE POLICY raa_indisciplina_school_read_v2 ON public.raa_indisciplina_eventos
  FOR SELECT TO authenticated USING (public.user_can_access_raa_school(escola_id));
CREATE POLICY raa_indisciplina_school_insert_v2 ON public.raa_indisciplina_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_raa_school(escola_id)
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro','diretor','secretaria','professor']::text[])
    AND registado_por = (SELECT auth.uid())
    AND estado = 'registado'
  );
CREATE POLICY raa_indisciplina_director_update_v2 ON public.raa_indisciplina_eventos
  FOR UPDATE TO authenticated
  USING (public.user_can_access_raa_school(escola_id)
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','diretor']::text[]))
  WITH CHECK (public.user_can_access_raa_school(escola_id)
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','diretor']::text[]));

REVOKE ALL ON TABLE public.raa_indisciplina_eventos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.raa_indisciplina_eventos TO authenticated;
GRANT UPDATE (estado, decisao_motivo, resolvido_por, resolvido_em, updated_at)
  ON TABLE public.raa_indisciplina_eventos TO authenticated;

CREATE OR REPLACE FUNCTION public.raa_guard_indisciplina_review_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE v_source_status text;
BEGIN
  IF OLD.estado NOT IN ('registado','em_analise')
     OR NEW.estado NOT IN ('em_analise','resolvido','cancelado')
     OR (OLD.estado = NEW.estado) THEN
    RAISE EXCEPTION 'Transição disciplinar inválida' USING ERRCODE='23514';
  END IF;
  IF (NEW.id,NEW.escola_id,NEW.ano_letivo_id,NEW.turma_id,NEW.matricula_id,
      NEW.aluno_id,NEW.gravidade,NEW.categoria,NEW.descricao,NEW.medida_aplicada,
      NEW.impacta_resultado,NEW.registado_por)
    IS DISTINCT FROM
     (OLD.id,OLD.escola_id,OLD.ano_letivo_id,OLD.turma_id,OLD.matricula_id,
      OLD.aluno_id,OLD.gravidade,OLD.categoria,OLD.descricao,OLD.medida_aplicada,
      OLD.impacta_resultado,OLD.registado_por) THEN
    RAISE EXCEPTION 'Factos disciplinares não podem ser editados no fecho' USING ERRCODE='23514';
  END IF;
  SELECT status INTO v_source_status FROM public.matriculas
   WHERE id=OLD.matricula_id AND escola_id=OLD.escola_id;
  IF v_source_status IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'O fecho legal da matrícula impede revisão disciplinar' USING ERRCODE='23514';
  END IF;
  IF length(btrim(COALESCE(NEW.decisao_motivo,''))) < 15 THEN
    RAISE EXCEPTION 'Revisão disciplinar exige fundamentação de 15 caracteres' USING ERRCODE='23514';
  END IF;
  IF NEW.estado IN ('resolvido','cancelado') THEN
    NEW.resolvido_por := (SELECT auth.uid());
    NEW.resolvido_em := now();
  ELSE
    NEW.resolvido_por := NULL;
    NEW.resolvido_em := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.raa_guard_indisciplina_review_v2() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_raa_guard_indisciplina_review_v2 ON public.raa_indisciplina_eventos;
CREATE TRIGGER trg_raa_guard_indisciplina_review_v2
BEFORE UPDATE ON public.raa_indisciplina_eventos
FOR EACH ROW EXECUTE FUNCTION public.raa_guard_indisciplina_review_v2();

-- Exam context is visible to members of the school; modifications require a
-- school role and must go through the same immutable source/year constraints.
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

CREATE OR REPLACE FUNCTION public.raa_assert_exam_result_context_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_m public.matriculas%ROWTYPE;
  v_s public.exame_sessoes%ROWTYPE;
  v_cd public.exame_componentes%ROWTYPE;
  v_td public.turma_disciplinas%ROWTYPE;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO v_m FROM public.matriculas WHERE id=NEW.matricula_id AND escola_id=NEW.escola_id;
    SELECT * INTO v_s FROM public.exame_sessoes WHERE id=NEW.exame_sessao_id AND escola_id=NEW.escola_id;
    SELECT * INTO v_cd FROM public.exame_componentes WHERE id=NEW.exame_componente_id AND escola_id=NEW.escola_id;
    SELECT * INTO v_td FROM public.turma_disciplinas WHERE id=NEW.turma_disciplina_id AND escola_id=NEW.escola_id;
    IF v_m.id IS NULL OR v_s.id IS NULL OR v_cd.id IS NULL OR v_td.id IS NULL
      OR v_m.aluno_id IS DISTINCT FROM NEW.aluno_id
      OR v_m.turma_id IS DISTINCT FROM v_td.turma_id
      OR v_m.session_id IS DISTINCT FROM v_s.ano_letivo_id
      OR (v_s.turma_id IS NOT NULL AND v_s.turma_id IS DISTINCT FROM v_m.turma_id)
      OR v_cd.exame_sessao_id IS DISTINCT FROM v_s.id
      OR v_m.status <> 'ativo'
      OR v_s.estado NOT IN ('aberta','publicada')
      OR NEW.estado <> 'submetido'
      OR NEW.nota IS NULL OR NEW.nota < 0 OR NEW.nota > v_cd.nota_max THEN
      RAISE EXCEPTION 'Resultado de exame sem vínculo/estado/escala legal' USING ERRCODE='23514';
    END IF;
    IF (SELECT auth.uid()) IS NOT NULL AND NEW.lancado_por IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Executor do lançamento difere do utilizador autenticado' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF OLD.estado <> 'submetido' OR NEW.estado NOT IN ('submetido','validado','anulado')
      OR (NEW.id,NEW.escola_id,NEW.exame_sessao_id,NEW.exame_componente_id,
          NEW.matricula_id,NEW.aluno_id,NEW.turma_disciplina_id,NEW.nota,NEW.lancado_por)
      IS DISTINCT FROM
         (OLD.id,OLD.escola_id,OLD.exame_sessao_id,OLD.exame_componente_id,
          OLD.matricula_id,OLD.aluno_id,OLD.turma_disciplina_id,OLD.nota,OLD.lancado_por) THEN
      RAISE EXCEPTION 'Resultado submetido é imutável: use a validação oficial' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.raa_assert_exam_result_context_v2() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_raa_assert_exam_result_context_v2 ON public.exame_resultados;
CREATE TRIGGER trg_raa_assert_exam_result_context_v2
 BEFORE INSERT OR UPDATE ON public.exame_resultados
 FOR EACH ROW EXECUTE FUNCTION public.raa_assert_exam_result_context_v2();

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
      WHERE s.id=exame_sessao_id AND s.escola_id=escola_id));
REVOKE ALL ON TABLE public.exame_componentes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.exame_componentes TO authenticated;

COMMIT;
