-- Additive change: the earlier daily-close migrations are already deployed.
BEGIN;
ALTER TYPE public.evento_tipo ADD VALUE IF NOT EXISTS 'financeiro.fecho.rejeitado';
-- The enum is used only when this trigger executes in a later transaction.
CREATE OR REPLACE FUNCTION public.financeiro_notificar_fecho_rejeitado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event uuid;
BEGIN
 IF OLD.status IS DISTINCT FROM 'declared' OR NEW.status IS DISTINCT FROM 'rejected' THEN RETURN NULL; END IF;
 -- The decision RPC has already validated the role, revision and school.
 INSERT INTO public.eventos(escola_id,tipo,actor_id,entidade_tipo,entidade_id,payload)
 VALUES(NEW.escola_id,'financeiro.fecho.rejeitado',NEW.approved_by,'fecho_caixa',NEW.id,jsonb_build_object('day_key',NEW.day_key,'revision',NEW.revision)) RETURNING id INTO v_event;
 INSERT INTO public.notificacoes(escola_id,evento_id,destinatario_id,titulo,corpo,prioridade,action_label,action_url,gatilho,tipo,agrupamento_chave)
 SELECT NEW.escola_id,v_event,e.user_id,'Caixa a regularizar','A declaração de '||NEW.day_key::text||' foi rejeitada. Consulte o motivo e registe a correção.','aviso'::public.notificacao_prioridade,'Regularizar caixa','/escola/'||NEW.escola_id::text||CASE WHEN e.papel IN ('admin_financeiro','admin_secretaria','admin_secretario') THEN '/operacoes' WHEN e.papel='financeiro' THEN '/financeiro' WHEN e.papel IN ('admin','admin_escola','staff_admin') THEN '/admin' ELSE '/secretaria' END||'/fecho-diario?date='||NEW.day_key::text,'S','A','caixa-rejeitado:'||NEW.id::text||':'||NEW.revision::text
 FROM public.escola_users e
 WHERE e.escola_id=NEW.escola_id AND e.tenant_type='k12'
 AND (e.user_id=NEW.declared_by OR e.papel IN ('secretaria','secretaria_financeiro','admin_secretaria','admin_secretario'))
 AND e.papel IN ('secretaria','secretaria_financeiro','admin_secretaria','admin_secretario','financeiro','admin_financeiro','admin','admin_escola','staff_admin')
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=e.user_id AND p.deleted_at IS NULL)
 ON CONFLICT(evento_id,destinatario_id) DO NOTHING;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.financeiro_notificar_fecho_rejeitado() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_financeiro_notificar_fecho_rejeitado AFTER UPDATE OF status ON public.fecho_caixa FOR EACH ROW
 WHEN (OLD.status='declared' AND NEW.status='rejected') EXECUTE FUNCTION public.financeiro_notificar_fecho_rejeitado();

-- List distinct people for the entire date, not only the currently loaded page.
CREATE OR REPLACE FUNCTION public.secretaria_expediente_responsaveis(p_escola_id uuid,p_day_key date)
RETURNS TABLE(actor_id uuid) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF NOT public.fecho_diario_has_role(p_escola_id,ARRAY['secretaria','admin_secretaria','admin_secretario','secretaria_financeiro','financeiro','admin_financeiro','admin','admin_escola','staff_admin','diretor']) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT DISTINCT o.actor_id FROM public.secretaria_expediente_operacoes o WHERE o.escola_id=p_escola_id AND o.day_key=p_day_key AND o.actor_id IS NOT NULL ORDER BY o.actor_id;
END; $$;
REVOKE ALL ON FUNCTION public.secretaria_expediente_responsaveis(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.secretaria_expediente_responsaveis(uuid,date) TO authenticated;
COMMIT;
