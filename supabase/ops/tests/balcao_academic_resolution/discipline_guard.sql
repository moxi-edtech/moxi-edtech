-- Existing disciplinary immutable-evidence guard.
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
