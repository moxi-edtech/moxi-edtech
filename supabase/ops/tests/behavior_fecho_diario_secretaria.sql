\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.escolas VALUES('10000000-0000-0000-0000-000000000001','k12'),('10000000-0000-0000-0000-000000000002','k12');
INSERT INTO auth.users VALUES('20000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002'),('20000000-0000-0000-0000-000000000003');
INSERT INTO public.escola_users VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','k12','secretaria'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','k12','admin'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','k12','admin');
INSERT INTO public.profiles SELECT id,NULL FROM auth.users;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',true);
SELECT public.secretaria_configurar_expediente('10000000-0000-0000-0000-000000000001','17:00',30,ARRAY[1,2,3,4,5],true,true);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001"}',true);
INSERT INTO public.atendimentos_balcao(escola_id,status) VALUES('10000000-0000-0000-0000-000000000001','open');
UPDATE public.atendimentos_balcao SET status='closed';
INSERT INTO public.pagamentos(escola_id,day_key,valor_pago,metodo,status) VALUES
 ('10000000-0000-0000-0000-000000000001',(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date,100,'cash','settled'),
 ('10000000-0000-0000-0000-000000000001',(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date,20,'legacy','settled');
DO $$
DECLARE d date:=(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date; f public.fecho_caixa; e public.secretaria_expedientes;
BEGIN
 f:=public.financeiro_fecho_declarar_e_snapshot('10000000-0000-0000-0000-000000000001',d,100,0,0,0);
 IF f.system_cash<>100 OR f.system_other<>20 OR f.system_other_count<>1 THEN RAISE EXCEPTION 'bad snapshot'; END IF;
 IF (public.financeiro_fecho_declarar_e_snapshot(f.escola_id,d,100,0,0,0)).id<>f.id THEN RAISE EXCEPTION 'duplicate declaration'; END IF;
 BEGIN
  PERFORM public.financeiro_fecho_declarar_e_snapshot(f.escola_id,d,99,0,0,0);
  RAISE EXCEPTION 'different replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'approved','test');
  RAISE EXCEPTION 'secretary approved';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 e:=public.secretaria_fechar_expediente(f.escola_id,d);
 IF e.operation_count<>4 OR e.business_count<>1 OR e.human_count<>4 THEN RAISE EXCEPTION 'bad close totals: %',to_jsonb(e); END IF;
 IF (public.secretaria_fechar_expediente(f.escola_id,d)).id<>e.id THEN RAISE EXCEPTION 'duplicate close'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
INSERT INTO public.official_document_exports(school_id,status) VALUES('10000000-0000-0000-0000-000000000001','completed');
INSERT INTO public.pagamentos(escola_id,day_key,valor_pago,metodo,status) VALUES('10000000-0000-0000-0000-000000000001',(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date,50,'cash','settled');
DO $$ BEGIN
 BEGIN DELETE FROM public.secretaria_expediente_operacoes; RAISE EXCEPTION 'privileged delete accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.fecho_caixa SET status='approved'; RAISE EXCEPTION 'privileged update accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE public.secretaria_expedientes CASCADE; RAISE EXCEPTION 'privileged truncate accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000003"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fecho_caixa) OR EXISTS(SELECT 1 FROM public.secretaria_expediente_operacoes) OR EXISTS(SELECT 1 FROM public.secretaria_expedientes) THEN RAISE EXCEPTION 'cross tenant read'; END IF;
 BEGIN
  PERFORM public.secretaria_fechar_expediente('10000000-0000-0000-0000-000000000001',(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date);
  RAISE EXCEPTION 'cross tenant close';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',true);
DO $$ DECLARE f public.fecho_caixa; BEGIN
 SELECT * INTO f FROM public.fecho_caixa;
 IF (public.financeiro_fecho_variacao(f.escola_id,f.day_key)->>'cash')::numeric<>50 THEN RAISE EXCEPTION 'bad late variation'; END IF;
 IF (SELECT count(*) FROM public.secretaria_expediente_operacoes WHERE is_after_close AND actor_id IS NULL AND origin='service_role')<>2 THEN RAISE EXCEPTION 'bad service capture'; END IF;
 BEGIN
  PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'approved');
  RAISE EXCEPTION 'missing justification accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'rejected','Corrigir valores');
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001"}',true);
DO $$ DECLARE f public.fecho_caixa; d date:=(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date; BEGIN
 f:=public.financeiro_fecho_regularizar('10000000-0000-0000-0000-000000000001',d,1,'30000000-0000-0000-0000-000000000001','Recontagem',150,0,0,0);
 IF f.revision<>2 OR f.status<>'declared' OR f.system_cash<>150 THEN RAISE EXCEPTION 'bad correction'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fecho_caixa_revisoes WHERE fecho_id=f.id AND revision=1 AND snapshot->>'status'='rejected' AND (snapshot->>'declared_cash')::numeric=100) THEN RAISE EXCEPTION 'history lost'; END IF;
 IF (public.financeiro_fecho_regularizar(f.escola_id,d,1,'30000000-0000-0000-0000-000000000001','Recontagem',150,0,0,0)).revision<>2 THEN RAISE EXCEPTION 'duplicate revision'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',true);
DO $$ DECLARE f public.fecho_caixa; BEGIN
 SELECT * INTO f FROM public.fecho_caixa;
 BEGIN
  PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'approved','Aceite','{"expected_revision":1}');
  RAISE EXCEPTION 'stale revision approved';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'approved','Meio legado confirmado','{"expected_revision":2}');
 PERFORM public.financeiro_fecho_aprovar(f.escola_id,f.id,'approved','Meio legado confirmado','{"expected_revision":2}');
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.outbox_events WHERE event_type='secretaria_expediente_email')<>1 THEN RAISE EXCEPTION 'email queue missing or duplicate'; END IF;
 IF (SELECT count(*) FROM public.eventos WHERE tipo='financeiro.fecho.autorizado')<>1 THEN RAISE EXCEPTION 'approval event duplication'; END IF;
 IF (SELECT count(*) FROM public.eventos WHERE tipo='secretaria.expediente.fechado')<>1 THEN RAISE EXCEPTION 'close event duplication'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notificacoes n JOIN public.eventos e ON e.id=n.evento_id WHERE e.tipo='financeiro.fecho.autorizado' AND n.destinatario_id='20000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'notification absent'; END IF;
END $$;
ROLLBACK;
