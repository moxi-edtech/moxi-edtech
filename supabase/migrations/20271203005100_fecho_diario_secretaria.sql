BEGIN;
-- Canonical scope: one financial declaration and one operational close per school/day.
CREATE OR REPLACE FUNCTION public.fecho_diario_has_role(p_escola_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.escola_users e WHERE e.escola_id=p_escola_id
 AND e.user_id=auth.uid() AND e.tenant_type='k12' AND e.papel=ANY(p_roles)
 );
$$;
REVOKE ALL ON FUNCTION public.fecho_diario_has_role(uuid,text[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.fecho_diario_has_role(uuid,text[]) TO authenticated;

-- Financial writes only via RPC; existing reads limited to authorized school roles.
ALTER TABLE public.fecho_caixa ADD COLUMN system_other numeric(14,2) NOT NULL DEFAULT 0, ADD COLUMN system_other_count bigint NOT NULL DEFAULT 0 CHECK(system_other_count>=0), ADD COLUMN approval_variation jsonb, ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0), ADD COLUMN revision_request uuid, ADD COLUMN revision_reason text;
REVOKE ALL ON public.fecho_caixa FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.fecho_caixa TO service_role;
GRANT SELECT ON public.fecho_caixa TO authenticated;
DROP POLICY IF EXISTS fecho_select ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_declare_secretaria ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_update_unified ON public.fecho_caixa;
CREATE POLICY fecho_select ON public.fecho_caixa FOR SELECT TO authenticated USING (
 public.fecho_diario_has_role(escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor'])
);

CREATE OR REPLACE FUNCTION public.financeiro_fecho_declarar_e_snapshot(p_escola_id uuid,p_day_key date,p_cash numeric,p_tpa numeric,p_transfer numeric,p_mcx numeric)
RETURNS public.fecho_caixa LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.fecho_caixa%ROWTYPE; v_cash numeric; v_tpa numeric; v_transfer numeric; v_mcx numeric; v_other numeric; v_other_count bigint;
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','admin_secretaria','admin_secretario']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_day_key IS NULL OR p_day_key>(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date OR EXISTS(SELECT 1 FROM unnest(ARRAY[p_cash,p_tpa,p_transfer,p_mcx]) v WHERE v IS NULL OR v<0 OR v>9999999999.99 OR v<>round(v,2)) THEN RAISE EXCEPTION 'invalid_declaration' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cash-close:'||p_escola_id::text||':'||p_day_key::text,0));
 SELECT * INTO v_row FROM public.fecho_caixa WHERE escola_id=p_escola_id AND day_key=p_day_key;
 IF FOUND THEN
  IF (v_row.declared_cash,v_row.declared_tpa,v_row.declared_transfer,v_row.declared_mcx) IS DISTINCT FROM (p_cash,p_tpa,p_transfer,p_mcx) THEN RAISE EXCEPTION 'declaration_conflict' USING ERRCODE='23505'; END IF;
  RETURN v_row;
 END IF;
 SELECT coalesce(sum(valor_pago) FILTER(WHERE metodo='cash'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='tpa'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='transfer'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IN ('mcx','kwik','kiwk')),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk')),0),count(*) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk'))
 INTO v_cash,v_tpa,v_transfer,v_mcx,v_other,v_other_count FROM public.pagamentos WHERE escola_id=p_escola_id AND day_key=p_day_key AND status='settled';
 INSERT INTO public.fecho_caixa(escola_id,day_key,operador_id,data_fecho,status,declared_by,declared_at,declared_cash,declared_tpa,declared_transfer,declared_mcx,system_cash,system_tpa,system_transfer,system_mcx,system_other,system_other_count,system_calculated_at,valor_declarado_especie,valor_declarado_tpa,valor_declarado_transferencia,valor_sistema_especie,valor_sistema_tpa,valor_sistema_transferencia,diferenca_especie,diferenca_tpa,diferenca_transferencia)
 VALUES(p_escola_id,p_day_key,auth.uid(),p_day_key,'declared',auth.uid(),clock_timestamp(),p_cash,p_tpa,p_transfer,p_mcx,v_cash,v_tpa,v_transfer,v_mcx,v_other,v_other_count,clock_timestamp(),p_cash,p_tpa,p_transfer,v_cash,v_tpa,v_transfer,p_cash-v_cash,p_tpa-v_tpa,p_transfer-v_transfer)
 RETURNING * INTO v_row;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details) VALUES(p_escola_id,auth.uid(),'FECHO_DECLARADO','fecho_caixa',v_row.id::text,'financeiro',jsonb_build_object('day_key',p_day_key));
 RETURN v_row;
END; $$;
-- Read-only reconciliation: report movements since declaration, never rewrite the snapshot.
CREATE TABLE public.fecho_caixa_revisoes (
 escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 fecho_id uuid NOT NULL REFERENCES public.fecho_caixa(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(fecho_id,revision)
);
ALTER TABLE public.fecho_caixa_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fecho_caixa_revisoes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.fecho_caixa_revisoes TO authenticated;
CREATE POLICY fecho_revisoes_read ON public.fecho_caixa_revisoes FOR SELECT TO authenticated USING(public.fecho_diario_has_role(escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']));
CREATE OR REPLACE FUNCTION public.financeiro_fecho_regularizar(p_escola_id uuid,p_day_key date,p_expected_revision integer,p_request_id uuid,p_reason text,p_cash numeric,p_tpa numeric,p_transfer numeric,p_mcx numeric)
RETURNS public.fecho_caixa LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE f public.fecho_caixa%ROWTYPE; v_cash numeric; v_tpa numeric; v_transfer numeric; v_mcx numeric; v_other numeric; v_other_count bigint;
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','admin_secretaria','admin_secretario']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_day_key IS NULL OR p_day_key>(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date OR p_expected_revision IS NULL OR p_request_id IS NULL OR nullif(trim(p_reason),'') IS NULL OR length(p_reason)>255 OR EXISTS(SELECT 1 FROM unnest(ARRAY[p_cash,p_tpa,p_transfer,p_mcx]) v WHERE v IS NULL OR v<0 OR v>9999999999.99 OR v<>round(v,2)) THEN RAISE EXCEPTION 'invalid_revision' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cash-close:'||p_escola_id::text||':'||p_day_key::text,0));
 SELECT * INTO f FROM public.fecho_caixa WHERE escola_id=p_escola_id AND day_key=p_day_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'fecho_not_found'; END IF;
 IF f.revision_request=p_request_id THEN
  IF f.revision=p_expected_revision+1 AND f.declared_by=auth.uid() AND (f.declared_cash,f.declared_tpa,f.declared_transfer,f.declared_mcx,f.revision_reason) IS NOT DISTINCT FROM (p_cash,p_tpa,p_transfer,p_mcx,trim(p_reason)) THEN RETURN f; END IF;
  RAISE EXCEPTION 'revision_conflict' USING ERRCODE='23505';
 END IF;
 IF f.status<>'rejected' OR f.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict' USING ERRCODE='23505'; END IF;
 SELECT coalesce(sum(valor_pago) FILTER(WHERE metodo='cash'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='tpa'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='transfer'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IN ('mcx','kwik','kiwk')),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk')),0),count(*) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk'))
 INTO v_cash,v_tpa,v_transfer,v_mcx,v_other,v_other_count FROM public.pagamentos WHERE escola_id=p_escola_id AND day_key=p_day_key AND status='settled';
 INSERT INTO public.fecho_caixa_revisoes(escola_id,fecho_id,revision,snapshot) VALUES(p_escola_id,f.id,f.revision,to_jsonb(f));
 UPDATE public.fecho_caixa SET revision=f.revision+1,revision_request=p_request_id,revision_reason=trim(p_reason),status='declared',operador_id=auth.uid(),declared_by=auth.uid(),declared_at=clock_timestamp(),declared_cash=p_cash,declared_tpa=p_tpa,declared_transfer=p_transfer,declared_mcx=p_mcx,system_cash=v_cash,system_tpa=v_tpa,system_transfer=v_transfer,system_mcx=v_mcx,system_other=v_other,system_other_count=v_other_count,system_calculated_at=clock_timestamp(),valor_declarado_especie=p_cash,valor_declarado_tpa=p_tpa,valor_declarado_transferencia=p_transfer,valor_sistema_especie=v_cash,valor_sistema_tpa=v_tpa,valor_sistema_transferencia=v_transfer,diferenca_especie=p_cash-v_cash,diferenca_tpa=p_tpa-v_tpa,diferenca_transferencia=p_transfer-v_transfer,approved_by=NULL,approved_at=NULL,approval_note=NULL,approval_variation=NULL,aprovado_por=NULL,aprovado_em=NULL,observacao_aprovador=NULL,updated_at=clock_timestamp()
 WHERE id=f.id RETURNING * INTO f;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details) VALUES(p_escola_id,auth.uid(),'FECHO_REGULARIZADO','fecho_caixa',f.id::text,'financeiro',jsonb_build_object('revision',f.revision,'reason',trim(p_reason)));
 RETURN f;
END; $$;
REVOKE ALL ON FUNCTION public.financeiro_fecho_regularizar(uuid,date,integer,uuid,text,numeric,numeric,numeric,numeric) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_fecho_regularizar(uuid,date,integer,uuid,text,numeric,numeric,numeric,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.financeiro_fecho_variacao(p_escola_id uuid,p_day_key date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE f public.fecho_caixa%ROWTYPE; v_cash numeric; v_tpa numeric; v_transfer numeric; v_mcx numeric; v_other numeric; v_other_count bigint;
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','admin_secretaria','admin_secretario','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM public.fecho_caixa WHERE escola_id=p_escola_id AND day_key=p_day_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(sum(valor_pago) FILTER(WHERE metodo='cash'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='tpa'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo='transfer'),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IN ('mcx','kwik','kiwk')),0),coalesce(sum(valor_pago) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk')),0),count(*) FILTER(WHERE metodo IS NULL OR metodo NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk'))
 INTO v_cash,v_tpa,v_transfer,v_mcx,v_other,v_other_count FROM public.pagamentos WHERE escola_id=p_escola_id AND day_key=p_day_key AND status='settled';
 RETURN jsonb_build_object('cash',v_cash-f.system_cash,'tpa',v_tpa-f.system_tpa,'transfer',v_transfer-f.system_transfer,'mcx',v_mcx-f.system_mcx,'other',v_other-f.system_other,'other_count',v_other_count-f.system_other_count);
END; $$;
REVOKE ALL ON FUNCTION public.financeiro_fecho_variacao(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_fecho_variacao(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_fecho_aprovar(p_escola_id uuid,p_fecho_id uuid,p_aprovacao text,p_justificativa text DEFAULT NULL,p_aprovacao_meta jsonb DEFAULT '{}'::jsonb)
RETURNS public.fecho_caixa LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.fecho_caixa%ROWTYPE; v_variation jsonb; v_event uuid;
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_aprovacao IS NULL OR p_aprovacao NOT IN ('approved','rejected') OR length(coalesce(p_justificativa,''))>255 OR (p_aprovacao='rejected' AND nullif(trim(p_justificativa),'') IS NULL) THEN RAISE EXCEPTION 'invalid_decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_row FROM public.fecho_caixa WHERE escola_id=p_escola_id AND id=p_fecho_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'fecho_not_found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cash-close:'||p_escola_id::text||':'||v_row.day_key::text,0));
 SELECT * INTO v_row FROM public.fecho_caixa WHERE escola_id=p_escola_id AND id=p_fecho_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'fecho_not_found'; END IF;
 IF coalesce(p_aprovacao_meta->>'expected_revision','1')<>v_row.revision::text THEN RAISE EXCEPTION 'stale_revision' USING ERRCODE='23505'; END IF;
 IF coalesce(v_row.declared_by,v_row.operador_id)=auth.uid() THEN RAISE EXCEPTION 'self_approval_not_allowed' USING ERRCODE='42501'; END IF;
 IF v_row.status=p_aprovacao THEN RETURN v_row; END IF;
 v_variation:=public.financeiro_fecho_variacao(p_escola_id,v_row.day_key);
 IF p_aprovacao='approved' AND (EXISTS(SELECT 1 FROM jsonb_each_text(v_variation) v WHERE v.value::numeric<>0) OR v_row.system_other_count>0 OR (v_row.declared_cash,v_row.declared_tpa,v_row.declared_transfer,v_row.declared_mcx) IS DISTINCT FROM (v_row.system_cash,v_row.system_tpa,v_row.system_transfer,v_row.system_mcx)) AND nullif(trim(p_justificativa),'') IS NULL THEN RAISE EXCEPTION 'variance_requires_justification' USING ERRCODE='22023'; END IF;
 IF v_row.status<>'declared' THEN RAISE EXCEPTION 'fecho_already_processed'; END IF;
 UPDATE public.fecho_caixa SET status=p_aprovacao,approved_by=auth.uid(),approved_at=clock_timestamp(),approval_note=p_justificativa,approval_variation=v_variation,aprovado_por=auth.uid(),aprovado_em=clock_timestamp(),observacao_aprovador=p_justificativa,updated_at=clock_timestamp()
 WHERE id=v_row.id RETURNING * INTO v_row;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details) VALUES(p_escola_id,auth.uid(),'FECHO_APROVADO','fecho_caixa',v_row.id::text,'financeiro',jsonb_build_object('status',p_aprovacao,'variation_at_approval',v_variation));
 IF p_aprovacao='approved' THEN
  INSERT INTO public.eventos(escola_id,tipo,actor_id,entidade_tipo,entidade_id,payload) VALUES(p_escola_id,'financeiro.fecho.autorizado',auth.uid(),'fecho_caixa',v_row.id,jsonb_build_object('day_key',v_row.day_key,'revision',v_row.revision)) RETURNING id INTO v_event;
  INSERT INTO public.notificacoes(escola_id,evento_id,destinatario_id,titulo,corpo,prioridade,action_label,action_url,gatilho,tipo,agrupamento_chave)
  SELECT p_escola_id,v_event,e.user_id,'Caixa aprovado',v_row.day_key::text||' · versão '||v_row.revision::text,'info'::public.notificacao_prioridade,'Consultar caixa','/escola/'||p_escola_id::text||'/financeiro/fecho?date='||v_row.day_key::text,'S','I','caixa:'||v_row.id::text||':'||v_row.revision::text
  FROM public.escola_users e WHERE e.escola_id=p_escola_id AND e.tenant_type='k12' AND (e.user_id=v_row.declared_by OR e.papel IN ('financeiro','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin')) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=e.user_id AND p.deleted_at IS NULL)
  ON CONFLICT(evento_id,destinatario_id) DO NOTHING;
 END IF;
 RETURN v_row;
END; $$;
-- Legacy signatures remain available, with the same authorization and transitions.
CREATE OR REPLACE FUNCTION public.declarar_fecho_caixa(p_escola_id uuid,p_valor_declarado_especie numeric,p_valor_declarado_tpa numeric,p_valor_declarado_transferencia numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ DECLARE v public.fecho_caixa; BEGIN
 v:=public.financeiro_fecho_declarar_e_snapshot(p_escola_id,(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date,p_valor_declarado_especie,p_valor_declarado_tpa,p_valor_declarado_transferencia,0);
 RETURN jsonb_build_object('ok',true,'fecho_id',v.id);
END; $$;
CREATE OR REPLACE FUNCTION public.aprovar_fecho_caixa(p_fecho_caixa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ DECLARE v public.fecho_caixa; BEGIN
 SELECT * INTO v FROM public.fecho_caixa WHERE id=p_fecho_caixa_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'fecho_not_found'; END IF;
 v:=public.financeiro_fecho_aprovar(v.escola_id,v.id,'approved');
 RETURN jsonb_build_object('ok',true,'fecho_id',v.id);
END; $$;
REVOKE ALL ON FUNCTION public.financeiro_fecho_declarar_e_snapshot(uuid,date,numeric,numeric,numeric,numeric),public.financeiro_fecho_aprovar(uuid,uuid,text,text,jsonb),public.declarar_fecho_caixa(uuid,numeric,numeric,numeric),public.aprovar_fecho_caixa(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_fecho_declarar_e_snapshot(uuid,date,numeric,numeric,numeric,numeric),public.financeiro_fecho_aprovar(uuid,uuid,text,text,jsonb),public.declarar_fecho_caixa(uuid,numeric,numeric,numeric),public.aprovar_fecho_caixa(uuid) TO authenticated;

-- Serialize payment mutations with cash declaration for their financial day(s).
CREATE OR REPLACE FUNCTION public.fecho_caixa_lock_payment_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE k bigint; keys bigint[]:=ARRAY[]::bigint[];
BEGIN
 IF TG_OP<>'INSERT' AND OLD.escola_id IS NOT NULL AND OLD.day_key IS NOT NULL THEN
  keys:=array_append(keys,hashtextextended('cash-close:'||OLD.escola_id::text||':'||OLD.day_key::text,0));
 END IF;
 IF TG_OP<>'DELETE' AND NEW.escola_id IS NOT NULL AND NEW.day_key IS NOT NULL THEN
  keys:=array_append(keys,hashtextextended('cash-close:'||NEW.escola_id::text||':'||NEW.day_key::text,0));
 END IF;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock_shared(k);
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.fecho_caixa_lock_payment_day() FROM PUBLIC,anon,authenticated,service_role;
-- Ordered after existing BEFORE defaults to use canonical school/day values.
CREATE TRIGGER zz_fecho_caixa_lock_payment_day BEFORE INSERT OR UPDATE OR DELETE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.fecho_caixa_lock_payment_day();

CREATE TABLE public.secretaria_expediente_meta (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 capture_started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.secretaria_expediente_meta(singleton) VALUES(true);
ALTER TABLE public.secretaria_expediente_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secretaria_expediente_meta FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.secretaria_expediente_capture_started_at(p_escola_id uuid)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$ DECLARE v timestamptz; BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 SELECT capture_started_at INTO v FROM public.secretaria_expediente_meta WHERE singleton;
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_expediente_capture_started_at(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.secretaria_expediente_capture_started_at(uuid) TO authenticated;
CREATE TABLE public.secretaria_expedientes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 day_key date NOT NULL, closed_at timestamptz NOT NULL, closed_by uuid NOT NULL,
 operation_count bigint NOT NULL CHECK(operation_count>=0), business_count bigint NOT NULL CHECK(business_count>=0), human_count bigint NOT NULL CHECK(human_count>=0), system_count bigint NOT NULL CHECK(system_count>=0), summary jsonb NOT NULL,
 CHECK (operation_count=human_count+system_count),
 UNIQUE(escola_id,day_key)
);
CREATE TABLE public.secretaria_expediente_operacoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 day_key date NOT NULL, occurred_at timestamptz NOT NULL, actor_id uuid, actor_role text NOT NULL,
 origin text NOT NULL CHECK(origin IN ('human','service_role')),
 CHECK ((origin='human' AND actor_id IS NOT NULL) OR (origin='service_role' AND actor_id IS NULL)),
 entity text NOT NULL, entity_id text NOT NULL, action text NOT NULL,
 record_kind text NOT NULL CHECK(record_kind IN ('business','mutation')),
 transaction_id text NOT NULL,
 is_after_close boolean NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX secretaria_expediente_operacoes_day_idx ON public.secretaria_expediente_operacoes(escola_id,day_key,id);
CREATE TABLE public.secretaria_expediente_config (
 escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE, close_time time NOT NULL DEFAULT '17:00',
 reminder_minutes integer NOT NULL DEFAULT 30 CHECK(reminder_minutes BETWEEN 0 AND 180),
 weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK(cardinality(weekdays)>0 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
 enabled boolean NOT NULL DEFAULT true,
 email_summary boolean NOT NULL DEFAULT false
);
CREATE TABLE public.secretaria_expediente_reminders (
 escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE, day_key date NOT NULL, PRIMARY KEY(escola_id,day_key)
);
ALTER TABLE public.secretaria_expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_expediente_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_expediente_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_expediente_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secretaria_expedientes,public.secretaria_expediente_operacoes,public.secretaria_expediente_config,public.secretaria_expediente_reminders FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.secretaria_expedientes,public.secretaria_expediente_operacoes,public.secretaria_expediente_config TO authenticated;
GRANT SELECT ON public.secretaria_expedientes,public.secretaria_expediente_config TO service_role;
CREATE POLICY expediente_read ON public.secretaria_expedientes FOR SELECT TO authenticated USING(public.fecho_diario_has_role(escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']));
CREATE POLICY expediente_operations_read ON public.secretaria_expediente_operacoes FOR SELECT TO authenticated USING(public.fecho_diario_has_role(escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']));
CREATE POLICY expediente_config_read ON public.secretaria_expediente_config FOR SELECT TO authenticated USING(public.fecho_diario_has_role(escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']));

-- Capture authoritative row mutations; never trust caller-supplied audit actor or arbitrary JSON.
CREATE OR REPLACE FUNCTION public.capture_secretaria_expediente_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_origin text:='human'; v_row jsonb; v_old jsonb; v_school uuid; v_at timestamptz; v_day date; v_late boolean; v_action text; v_detail jsonb; v_entity text:=coalesce(TG_ARGV[0],TG_TABLE_NAME);
BEGIN
 -- Never infer a human from mutable row metadata or a request header.
 IF v_actor IS NULL THEN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RETURN NULL; END IF;
  v_origin:='service_role'; v_role:='system';
 END IF;
 v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 v_old:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 IF TG_OP='UPDATE' AND (v_row-'updated_at'-'updated_by'-'last_printed_at'-'status_fiscal'-'fiscal_error') IS NOT DISTINCT FROM (v_old-'updated_at'-'updated_by'-'last_printed_at'-'status_fiscal'-'fiscal_error') THEN RETURN NULL; END IF;
 v_school:=coalesce(v_row->>'escola_id',v_row->>'school_id')::uuid;
 IF v_school IS NULL OR v_row->>'id' IS NULL THEN RETURN NULL; END IF;
 IF v_origin='human' THEN
  SELECT papel INTO v_role FROM public.escola_users WHERE escola_id=v_school AND user_id=v_actor AND tenant_type='k12' AND papel IN ('secretaria','secretaria_financeiro','admin_secretaria','admin_secretario','admin_financeiro','financeiro','admin','admin_escola','staff_admin','diretor') ORDER BY papel LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
 ELSE
  -- Service workers can touch K12 and other products; never mix these tenants.
  IF NOT EXISTS(SELECT 1 FROM public.escolas WHERE id=v_school AND tenant_type='k12') THEN RETURN NULL; END IF;
 END IF;
 v_at:=clock_timestamp(); v_day:=(v_at AT TIME ZONE 'Africa/Luanda')::date;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('secretaria-close:'||v_school::text||':'||v_day::text,0));
 v_at:=clock_timestamp();
 -- A transaction may wait across midnight: re-lock the new local day before classifying.
 IF (v_at AT TIME ZONE 'Africa/Luanda')::date<>v_day THEN
  v_day:=(v_at AT TIME ZONE 'Africa/Luanda')::date;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('secretaria-close:'||v_school::text||':'||v_day::text,0));
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.secretaria_expedientes WHERE escola_id=v_school AND day_key=v_day) INTO v_late;
 v_action:=CASE WHEN TG_OP='INSERT' THEN 'CREATE' WHEN TG_OP='DELETE' THEN 'DELETE' ELSE 'UPDATE' END;
 v_detail:=jsonb_strip_nulls(jsonb_build_object('aluno_id',v_row->>'aluno_id','matricula_id',v_row->>'matricula_id','status_anterior',coalesce(v_old->>'status',v_old->>'estado'),'status',coalesce(v_row->>'status',v_row->>'estado'),'tipo',coalesce(v_row->>'tipo',v_row->>'acao'),'valor',CASE WHEN v_entity='pagamentos' THEN v_row->>'valor_pago' WHEN v_entity='financeiro_estornos' THEN v_row->>'valor' END,'metodo',CASE WHEN v_entity='pagamentos' THEN v_row->>'metodo' END,'payment_day',CASE WHEN v_entity='pagamentos' THEN v_row->>'day_key' END,'print_count',CASE WHEN v_entity='documentos_emitidos' THEN v_row->>'print_count' END));
 INSERT INTO public.secretaria_expediente_operacoes(escola_id,day_key,occurred_at,actor_id,actor_role,origin,entity,entity_id,action,record_kind,transaction_id,is_after_close,detail)
 VALUES(v_school,v_day,v_at,v_actor,v_role,v_origin,v_entity,v_row->>'id',v_action,CASE WHEN v_entity IN ('atendimentos_balcao','balcao_academic_operacoes','balcao_historic_recovery_requests','balcao_late_reenroll_authorizations','melhoria_nota_pedidos','official_document_exports','virada_importacoes') THEN 'business' ELSE 'mutation' END,pg_current_xact_id()::text,v_late,v_detail);
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.capture_secretaria_expediente_operation() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['alunos','candidaturas','matriculas','pagamentos','documentos_emitidos','servico_pedidos','mensalidades','notas','financeiro_lancamentos','financeiro_estornos','reapreciacao_pedidos','frequencias','aluno_encarregados','matricula_reclassificacoes','matricula_desistencia_sinalizacoes','matricula_desistencia_reativacoes','financeiro_pagamento_alocacoes','financeiro_pagamento_reversoes','financeiro_cobrancas','financeiro_reconciliacoes_mensalidades','pautas_oficiais','pauta_conclusoes','excecoes_pauta','professores','turmas','turma_disciplinas','turma_disciplinas_professores','quadro_horarios','horario_slots','horario_versoes','horario_eventos','aluno_falta_justificacoes','frequencia_status_periodo','rematricula_janelas','atendimentos_balcao','balcao_academic_operacoes','balcao_historic_recovery_requests','balcao_late_reenroll_authorizations','melhoria_nota_pedidos','official_document_exports','virada_importacoes'] LOOP
 EXECUTE format('CREATE TRIGGER trg_secretaria_expediente_operation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_secretaria_expediente_operation(%L)',t,t);
 END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.secretaria_fechar_expediente(p_escola_id uuid,p_day_key date)
RETURNS public.secretaria_expedientes LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.secretaria_expedientes; v_summary jsonb; v_count bigint; v_human bigint; v_system bigint; v_business bigint; v_event uuid;
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','secretaria_financeiro','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_day_key IS NULL OR p_day_key>(clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date OR p_day_key<(public.secretaria_expediente_capture_started_at(p_escola_id) AT TIME ZONE 'Africa/Luanda')::date THEN RAISE EXCEPTION 'invalid_day' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('secretaria-close:'||p_escola_id::text||':'||p_day_key::text,0));
 SELECT * INTO v FROM public.secretaria_expedientes WHERE escola_id=p_escola_id AND day_key=p_day_key;
 IF FOUND THEN RETURN v; END IF;
 SELECT coalesce(jsonb_object_agg(entity,n),'{}'::jsonb),coalesce(sum(n),0),coalesce(sum(h),0),coalesce(sum(a),0) INTO v_summary,v_count,v_human,v_system FROM (
 SELECT entity,count(*) n,count(*) FILTER(WHERE origin='human') h,count(*) FILTER(WHERE origin='service_role') a FROM public.secretaria_expediente_operacoes WHERE escola_id=p_escola_id AND day_key=p_day_key AND NOT is_after_close GROUP BY entity
 ) s;
 SELECT count(DISTINCT (entity,entity_id)) INTO v_business FROM public.secretaria_expediente_operacoes WHERE escola_id=p_escola_id AND day_key=p_day_key AND NOT is_after_close AND record_kind='business';
 INSERT INTO public.secretaria_expedientes(escola_id,day_key,closed_at,closed_by,operation_count,business_count,human_count,system_count,summary) VALUES(p_escola_id,p_day_key,clock_timestamp(),auth.uid(),v_count,v_business,v_human,v_system,v_summary) RETURNING * INTO v;
 INSERT INTO public.eventos(escola_id,tipo,actor_id,entidade_tipo,entidade_id,payload) VALUES(p_escola_id,'secretaria.expediente.fechado',auth.uid(),'secretaria_expedientes',v.id,jsonb_build_object('day_key',p_day_key,'operation_count',v_count,'business_count',v_business,'human_count',v_human,'system_count',v_system)) RETURNING id INTO v_event;
 INSERT INTO public.notificacoes(escola_id,evento_id,destinatario_id,titulo,corpo,prioridade,action_label,action_url,gatilho,tipo,agrupamento_chave)
 SELECT DISTINCT p_escola_id,v_event,e.user_id,'Expediente concluído',p_day_key::text||' · '||v_human::text||' registos humanos e '||v_system::text||' automáticos','info'::public.notificacao_prioridade,'Consultar fecho','/escola/'||p_escola_id::text||CASE WHEN e.papel IN ('admin_financeiro','admin_secretaria','admin_secretario') THEN '/operacoes' ELSE '/admin' END||'/fecho-diario?date='||p_day_key::text,'S','I','expediente:'||v.id::text
 FROM public.escola_users e WHERE e.escola_id=p_escola_id AND e.tenant_type='k12' AND e.papel IN ('admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=e.user_id AND p.deleted_at IS NULL)
 ON CONFLICT(evento_id,destinatario_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.secretaria_expediente_config WHERE escola_id=p_escola_id AND email_summary) THEN
  INSERT INTO public.outbox_events(escola_id,event_type,dedupe_key,idempotency_key,payload,tenant_scope)
  SELECT p_escola_id,'secretaria_expediente_email','expediente-email:'||v.id::text||':'||n.destinatario_id::text,'expediente-email:'||v.id::text||':'||n.destinatario_id::text,jsonb_build_object('close_id',v.id,'recipient_id',n.destinatario_id),'k12'
  FROM public.notificacoes n WHERE n.evento_id=v_event AND n.escola_id=p_escola_id
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_fechar_expediente(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.secretaria_fechar_expediente(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.secretaria_configurar_expediente(p_escola_id uuid,p_close_time time,p_reminder_minutes integer,p_weekdays integer[],p_enabled boolean,p_email_summary boolean DEFAULT false)
RETURNS public.secretaria_expediente_config LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v public.secretaria_expediente_config; BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 INSERT INTO public.secretaria_expediente_config VALUES(p_escola_id,p_close_time,p_reminder_minutes,p_weekdays,p_enabled,p_email_summary)
 ON CONFLICT(escola_id) DO UPDATE SET close_time=excluded.close_time,reminder_minutes=excluded.reminder_minutes,weekdays=excluded.weekdays,enabled=excluded.enabled,email_summary=excluded.email_summary RETURNING * INTO v;
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_configurar_expediente(uuid,time,integer,integer[],boolean,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.secretaria_configurar_expediente(uuid,time,integer,integer[],boolean,boolean) TO authenticated;
-- Opt-in per school configuration; one durable reminder per day, no polling clients.
CREATE OR REPLACE FUNCTION public.secretaria_enviar_lembretes_expediente()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE c record; v_now timestamp:=clock_timestamp() AT TIME ZONE 'Africa/Luanda'; v_day date:=v_now::date; v_event uuid; v_n integer:=0;
BEGIN
 FOR c IN SELECT * FROM public.secretaria_expediente_config x WHERE x.enabled AND extract(isodow FROM v_now)::integer=ANY(x.weekdays)
 AND v_now >= v_day+x.close_time-make_interval(mins=>x.reminder_minutes) AND v_now < v_day+x.close_time+interval '1 hour'
 AND NOT EXISTS(SELECT 1 FROM public.secretaria_expedientes f WHERE f.escola_id=x.escola_id AND f.day_key=v_day)
 AND NOT EXISTS(SELECT 1 FROM public.secretaria_expediente_reminders r WHERE r.escola_id=x.escola_id AND r.day_key=v_day)
 LOOP
 IF NOT pg_try_advisory_xact_lock(hashtextextended('secretaria-close:'||c.escola_id::text||':'||v_day::text,0)) THEN CONTINUE; END IF;
 IF EXISTS(SELECT 1 FROM public.secretaria_expedientes WHERE escola_id=c.escola_id AND day_key=v_day) THEN CONTINUE; END IF;
 INSERT INTO public.secretaria_expediente_reminders VALUES(c.escola_id,v_day) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN CONTINUE; END IF;
 INSERT INTO public.eventos(escola_id,tipo,payload,entidade_tipo) VALUES(c.escola_id,'secretaria.expediente.lembrete',jsonb_build_object('day_key',v_day),'secretaria_expedientes') RETURNING id INTO v_event;
 INSERT INTO public.notificacoes(escola_id,evento_id,destinatario_id,titulo,corpo,prioridade,action_label,action_url,gatilho,tipo,agrupamento_chave)
 SELECT DISTINCT c.escola_id,v_event,e.user_id,'Fecho do expediente','O expediente de hoje ainda está por fechar.','aviso'::public.notificacao_prioridade,'Fechar expediente','/escola/'||c.escola_id::text||CASE WHEN e.papel IN ('admin_financeiro','admin_secretaria','admin_secretario') THEN '/operacoes' ELSE '/secretaria' END||'/fecho-diario?date='||v_day::text,'S','A','expediente-lembrete:'||v_day::text
 FROM public.escola_users e WHERE e.escola_id=c.escola_id AND e.tenant_type='k12' AND e.papel IN ('secretaria','secretaria_financeiro','admin_secretaria','admin_secretario','admin_financeiro') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=e.user_id AND p.deleted_at IS NULL)
 ON CONFLICT(evento_id,destinatario_id) DO NOTHING;
 v_n:=v_n+1;
 END LOOP;
 RETURN v_n;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_enviar_lembretes_expediente() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.secretaria_enviar_lembretes_expediente() TO service_role;
-- Preview totals from the same durable ledger, not client-side pagination.
CREATE OR REPLACE FUNCTION public.secretaria_expediente_resumo(p_escola_id uuid,p_day_key date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$ DECLARE v jsonb; BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_object_agg(entity,n),'{}'::jsonb) INTO v FROM(SELECT entity,count(*) n FROM public.secretaria_expediente_operacoes WHERE escola_id=p_escola_id AND day_key=p_day_key AND NOT is_after_close GROUP BY entity)s;
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_expediente_resumo(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.secretaria_expediente_resumo(uuid,date) TO authenticated;
SELECT cron.schedule('secretaria-expediente-reminder','*/15 * * * *','SELECT public.secretaria_enviar_lembretes_expediente();');
COMMIT;
