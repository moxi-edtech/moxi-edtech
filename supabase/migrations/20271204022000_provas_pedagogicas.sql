BEGIN;
-- Resolve the existing regime for all eligible turmas of a published matrix.
CREATE FUNCTION provas_private.provas_cotacao_max(p_escola uuid,p_ano uuid,p_matriz uuid,p_trimestre integer)
RETURNS integer LANGUAGE sql STABLE SET search_path='' AS $scale$
 WITH eligible AS MATERIALIZED (
  SELECT t.id FROM public.turmas t
  JOIN public.curso_matriz cm ON cm.id=p_matriz AND cm.escola_id=t.escola_id AND cm.classe_id=t.classe_id AND cm.curso_id=t.curso_id
  JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=t.escola_id AND cc.ano_letivo_id=p_ano
  WHERE t.escola_id=p_escola AND t.ano_letivo_id=p_ano AND t.session_id=p_ano
   AND EXISTS (SELECT 1 FROM public.turma_disciplinas td WHERE td.escola_id=p_escola AND td.turma_id=t.id AND td.curso_matriz_id=p_matriz
    AND (td.periodos_ativos IS NULL OR p_trimestre=ANY(td.periodos_ativos)))
 ), scales AS MATERIALIZED (
  SELECT CASE public.resolve_regime_academico(id)->>'escala'
   WHEN 'quantitativa_primario' THEN 1000 WHEN 'quantitativa_secundario' THEN 2000 WHEN 'qualitativa' THEN 0 END AS cent FROM eligible
 )
 SELECT CASE WHEN count(*)>0 AND count(cent)=count(*) AND min(cent)=max(cent) THEN min(cent) END FROM scales;
$scale$;
REVOKE ALL ON FUNCTION provas_private.provas_cotacao_max(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION provas_private.provas_contexto(p_escola uuid,p_ano uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $context$
DECLARE v_result jsonb;
BEGIN
 IF NOT provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro','professor']) THEN
  RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501';
 END IF;
 IF p_ano IS NULL THEN
  SELECT coalesce(jsonb_agg(to_jsonb(y) ORDER BY y.ativo DESC,y.data_inicio DESC,y.id),'[]'::jsonb) INTO v_result
  FROM (SELECT a.id,a.ativo,a.data_inicio,
   extract(year from a.data_inicio)::integer::text||'/'||extract(year from a.data_fim)::integer::text AS label
   FROM public.anos_letivos a WHERE a.escola_id=p_escola ORDER BY a.ativo DESC,a.data_inicio DESC,a.id LIMIT 101) y;
  IF jsonb_array_length(v_result)>100 THEN RAISE EXCEPTION 'too_many_academic_years' USING ERRCODE='22023'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.anos_letivos WHERE id=p_ano AND escola_id=p_escola) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('cotacao_max_cent',provas_private.provas_cotacao_max(p_escola,o.ano_letivo_id,o.curso_matriz_id,o.trimestre)) ORDER BY o.curso,o.classe,o.disciplina,o.curso_matriz_id,o.trimestre),'[]'::jsonb) INTO v_result
  FROM (SELECT * FROM provas_private.provas_opcoes(p_escola,p_ano,NULL) ORDER BY curso,classe,disciplina,curso_matriz_id,trimestre LIMIT 1501) o;
  IF jsonb_array_length(v_result)>1500 THEN RAISE EXCEPTION 'too_many_academic_options' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN v_result;
END;
$context$;
-- Existing approved documents remain untouched; drafts may be incomplete.
CREATE FUNCTION provas_private.provas_guard_cotacao()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
DECLARE v_max integer; v_total bigint; v_questions integer; v_missing integer; v_marked integer;
BEGIN
 IF NEW.estado NOT IN ('em_revisao','aprovada') THEN RETURN NEW; END IF;
 v_max:=provas_private.provas_cotacao_max(NEW.escola_id,NEW.ano_letivo_id,NEW.curso_matriz_id,NEW.trimestre);
 IF v_max IS NULL THEN RAISE EXCEPTION 'unavailable_exam_scale' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE coalesce((b->>'cotacao_cent')::integer,0)<=0),
  count(*) FILTER(WHERE b ? 'cotacao_cent'),coalesce(sum((b->>'cotacao_cent')::integer),0)
 INTO v_questions,v_missing,v_marked,v_total
 FROM jsonb_array_elements(NEW.conteudo) b WHERE b->>'tipo' NOT IN ('grupo','texto');
 IF v_questions=0 OR (v_max=0 AND v_marked<>0) OR (v_max>0 AND (v_total<>v_max OR v_missing<>0)) THEN
  RAISE EXCEPTION 'invalid_exam_cotacao' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION provas_private.provas_guard_cotacao() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER provas_guard_cotacao BEFORE INSERT OR UPDATE OF estado,conteudo,curso_matriz_id,ano_letivo_id,trimestre
 ON public.provas_pedagogicas FOR EACH ROW EXECUTE FUNCTION provas_private.provas_guard_cotacao();
COMMIT;
