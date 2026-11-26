\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE png text:='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII='; good jsonb; f jsonb; bad jsonb; b jsonb; src text; v_lote jsonb; v_id uuid;
BEGIN
 f:=jsonb_build_object('src',png,'alt','Figura sintética');
 b:=jsonb_build_object('tipo','desenho','texto','Pinte a figura','linhas',0,'figuras',jsonb_build_array(f));
 good:=jsonb_build_array(b);
 PERFORM provas_private.provas_validar_blocos(good);
 FOREACH src IN ARRAY ARRAY['https://evil.test/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,AAAA',png||'!','data:image/png;base64,'||replace(encode(decode('89504e470d0a1a0a0000000d49484452000004b100000001080600000000000000','hex'),'base64'),chr(10),'')] LOOP
  BEGIN
   PERFORM provas_private.provas_validar_blocos(jsonb_build_array(jsonb_set(b,'{figuras,0,src}',to_jsonb(src))));
   RAISE EXCEPTION 'invalid source accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 FOR bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
  jsonb_build_array(jsonb_set(b,'{tipo}','"grupo"')),
  jsonb_build_array(jsonb_set(b,'{figuras,0,alt}','""')),
  jsonb_build_array(jsonb_set(b,'{figuras}','[]')),
  jsonb_build_array(jsonb_set(b,'{figuras}',(SELECT jsonb_agg(f) FROM generate_series(1,7)))),
  (SELECT jsonb_agg(jsonb_set(b,'{figuras}',(SELECT jsonb_agg(f) FROM generate_series(1,6)))) FROM generate_series(1,5))
 )) LOOP
  BEGIN
   PERFORM provas_private.provas_validar_blocos(bad);
   RAISE EXCEPTION 'invalid figure block accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 UPDATE public.turmas SET fixture_escala='qualitativa' WHERE escola_id='00000000-0000-4000-8000-000000000001';
 -- The actual fixture resolver expects the canonical qualitative regime name.
 IF provas_private.provas_cotacao_max('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',1) IS DISTINCT FROM 0 THEN
  RAISE EXCEPTION 'qualitative fixture not resolved';
 END IF;
 v_lote:=jsonb_build_array(jsonb_build_object('chave','figure-qualitative','dados',jsonb_build_object('ano_letivo_id','20000000-0000-4000-8000-000000000001','curso_matriz_id','70000000-0000-4000-8000-000000000001','trimestre',1,'titulo','Prova ilustrada sintética','duracao',60,'serie','A','conteudo',good)));
 SELECT prova_id INTO STRICT v_id FROM provas_private.provas_importar_sistema('00000000-0000-4000-8000-000000000001',v_lote);
 IF NOT EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=v_id AND conteudo=good AND estado='rascunho') THEN RAISE EXCEPTION 'qualitative figure import failed'; END IF;
 BEGIN
  PERFORM provas_private.provas_importar_sistema('00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(v_lote,'{0,chave}','"figure-numeric-invalid"'),'{0,dados,conteudo,0,cotacao_cent}','100',true));
  RAISE EXCEPTION 'numeric scoring accepted in qualitative exam';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('test.figura_id',v_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=current_setting('test.figura_id')::uuid) THEN RAISE EXCEPTION 'figure leaked across school'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE r public.provas_pedagogicas; BEGIN
 SELECT * INTO STRICT r FROM public.provas_pedagogicas WHERE id=current_setting('test.figura_id')::uuid;
 SELECT * INTO r FROM public.provas_mutar(r.escola_id,r.id,r.versao,'submeter',NULL);
 IF r.estado<>'em_revisao' THEN RAISE EXCEPTION 'qualitative exam submission failed'; END IF;
END $$;
ROLLBACK;
