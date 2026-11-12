-- All identifiers belong to the disposable fixture.
INSERT INTO public.periodos_letivos(id,escola_id,ano_letivo_id,tipo,numero,data_inicio,data_fim)
SELECT gen_random_uuid(),'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','TRIMESTRE',n,'2025-01-01','2025-12-31' FROM generate_series(2,3)n;
GRANT SELECT ON public.audit_logs TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ DECLARE cells jsonb; result jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('turma_disciplina_id','80000000-0000-4000-8000-000000000001','trimestre',n,'tipo_avaliacao',code,'valor',CASE WHEN n=1 AND code='MAC' THEN 0 ELSE 12 END)) INTO cells
 FROM generate_series(1,3)n CROSS JOIN unnest(ARRAY['MAC','NPP','NPT'])code;
 result:=public.lancar_notas_historicas_individuais('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',cells,'Transcrição de pauta física para os três trimestres.');
 IF result->>'saved'<>'9' OR (SELECT count(*) FROM public.notas)<>9 OR (SELECT count(*) FROM public.audit_logs WHERE action='BALCAO_NOTA_HISTORICA_LANCADA')<>9 THEN RAISE EXCEPTION 'FAIL: complete audited annual batch not persisted'; END IF;
 IF (SELECT count(*) FROM public.notas WHERE valor=0)<>1 THEN RAISE EXCEPTION 'FAIL: actual zero lost'; END IF;
 -- A later invalid grade must roll back the earlier valid grade and its audit.
 cells:='[{"turma_disciplina_id":"80000000-0000-4000-8000-000000000001","trimestre":1,"tipo_avaliacao":"MAC","valor":9},{"turma_disciplina_id":"80000000-0000-4000-8000-000000000001","trimestre":2,"tipo_avaliacao":"MAC","valor":21}]';
 BEGIN
 PERFORM public.lancar_notas_historicas_individuais('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',cells,'Teste de rollback atómico dos três trimestres.');
 RAISE EXCEPTION 'FAIL: invalid scale accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.notas WHERE valor=0)<>1 OR (SELECT count(*) FROM public.audit_logs WHERE action='BALCAO_NOTA_HISTORICA_LANCADA')<>9 THEN RAISE EXCEPTION 'FAIL: partial batch escaped rollback'; END IF;
 BEGIN PERFORM public.lancar_notas_historicas_individuais('20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',cells,'Tentativa de outra escola deve ser recusada.'); RAISE EXCEPTION 'FAIL: crossed tenant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.lancar_notas_historicas_individuais('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',jsonb_build_array(cells->0,cells->0),'Componente duplicado deve ser recusado.'); RAISE EXCEPTION 'FAIL: duplicate cell accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF public.can_write_historical_grade('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: nonce leaked'; END IF;
END $$;
RESET ROLE;
UPDATE public.matriculas SET status='concluido' WHERE id='60000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.lancar_notas_historicas_individuais('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','[{"turma_disciplina_id":"80000000-0000-4000-8000-000000000001","trimestre":1,"tipo_avaliacao":"MAC","valor":10}]','Concluído não pode receber outra transcrição.'); RAISE EXCEPTION 'FAIL: concluded source was writable'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
