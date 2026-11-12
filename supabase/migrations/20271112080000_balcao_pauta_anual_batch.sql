BEGIN;
-- No new grade tables or alternate writer. One transaction holds the selected
-- enrollment lock while the existing RPC performs every protected/audited write.
CREATE OR REPLACE FUNCTION public.lancar_notas_historicas_individuais(
 p_escola_id uuid,p_matricula_id uuid,p_notas jsonb,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $batch$
DECLARE m public.matriculas%ROWTYPE; cell record; periods integer; total integer; seen integer; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
 OR NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
 AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor'))
 THEN RAISE EXCEPTION 'AUTH: sem permissão para notas históricas' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_notas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'DATA: notas inválidas' USING ERRCODE='22023'; END IF;
 total:=jsonb_array_length(p_notas);
 IF total NOT BETWEEN 1 AND 300 OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
 RAISE EXCEPTION 'DATA: notas ou motivo inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.matriculas WHERE escola_id=p_escola_id AND id=p_matricula_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: matrícula não encontrada' USING ERRCODE='22023'; END IF;
 SELECT count(DISTINCT (x->>'turma_disciplina_id',x->>'trimestre',x->>'tipo_avaliacao')) INTO seen FROM jsonb_array_elements(p_notas)x;
 IF seen<>total THEN RAISE EXCEPTION 'DATA: componente repetido' USING ERRCODE='22023'; END IF;
 FOR cell IN SELECT * FROM jsonb_to_recordset(p_notas) AS x(turma_disciplina_id uuid,trimestre int,tipo_avaliacao text,valor numeric) LOOP
   IF cell.trimestre IS NULL OR cell.trimestre NOT BETWEEN 1 AND 3 OR cell.tipo_avaliacao IS NULL
      OR cell.tipo_avaliacao NOT IN ('MAC','NPP','NPT') OR cell.valor IS NULL OR cell.valor::text IN ('NaN','Infinity','-Infinity')
      OR cell.valor<0 OR cell.valor>20 THEN RAISE EXCEPTION 'DATA: componente ou valor inválido' USING ERRCODE='22023'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.turma_disciplinas td WHERE td.id=cell.turma_disciplina_id AND td.escola_id=p_escola_id AND td.turma_id=m.turma_id
     AND (coalesce(cardinality(td.periodos_ativos),0)=0 OR cell.trimestre=ANY(td.periodos_ativos))) THEN
     RAISE EXCEPTION 'DATA: disciplina ou trimestre fora da matrícula' USING ERRCODE='23514';
   END IF;
   SELECT count(*) INTO periods FROM public.periodos_letivos p WHERE p.escola_id=p_escola_id AND p.ano_letivo_id=m.session_id
     AND p.tipo='TRIMESTRE' AND p.numero=cell.trimestre;
   IF periods<>1 OR NOT EXISTS(SELECT 1 FROM public.periodos_letivos p WHERE p.escola_id=p_escola_id AND p.ano_letivo_id=m.session_id
     AND p.tipo='TRIMESTRE' AND p.numero=cell.trimestre AND p.offering_id IS NULL
     AND p.data_inicio IS NOT NULL AND p.data_fim IS NOT NULL AND p.data_inicio<=p.data_fim
     AND p.data_inicio<=(now() AT TIME ZONE 'Africa/Luanda')::date) THEN
     RAISE EXCEPTION 'DATA: trimestre indisponível ou calendário ambíguo' USING ERRCODE='23514';
   END IF;
   result := public.lancar_nota_historica_individual(p_escola_id,m.id,cell.turma_disciplina_id,cell.trimestre,cell.tipo_avaliacao,cell.valor,p_motivo);
   IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'HISTORIC_GRADE_WRITE_FAILED' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'saved',total,'matricula_id',m.id);
END $batch$;
REVOKE ALL ON FUNCTION public.lancar_notas_historicas_individuais(uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lancar_notas_historicas_individuais(uuid,uuid,jsonb,text) TO authenticated;
COMMIT;

