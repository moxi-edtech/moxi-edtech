-- Disposable fixture: exact production exam guard from 20271029235920.
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
