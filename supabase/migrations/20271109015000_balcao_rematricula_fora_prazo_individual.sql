-- An out-of-window renewal is a per-enrollment, authenticated exception.
-- No school-wide window extension and no override of academic/financial gates.
BEGIN;
CREATE TABLE public.balcao_late_reenroll_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL,
 matricula_origem_id uuid NOT NULL,
 ano_destino_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 12 AND 500),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 minutes'),
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (escola_id,matricula_origem_id,ano_destino_id,actor_id)
);
CREATE INDEX balcao_late_reenroll_pending_idx
 ON public.balcao_late_reenroll_authorizations
 (escola_id,matricula_origem_id,ano_destino_id,actor_id,expires_at)
 WHERE used_at IS NULL;
ALTER TABLE public.balcao_late_reenroll_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balcao_late_reenroll_authorizations FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tem_autorizacao_rematricula_fora_prazo(
 p_escola_id uuid,p_matricula_origem_id uuid,p_ano_destino_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $func$
 SELECT auth.uid() IS NOT NULL
 AND public.current_tenant_escola_id()=p_escola_id
 AND EXISTS (
   SELECT 1 FROM public.balcao_late_reenroll_authorizations a
   WHERE a.escola_id=p_escola_id
     AND a.matricula_origem_id=p_matricula_origem_id
     AND a.ano_destino_id=p_ano_destino_id
     AND a.actor_id=auth.uid() AND a.expires_at>now()
     AND a.used_at IS NULL
 );
$func$;
REVOKE ALL ON FUNCTION public.tem_autorizacao_rematricula_fora_prazo(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tem_autorizacao_rematricula_fora_prazo(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.autorizar_rematricula_fora_prazo(
 p_escola_id uuid,p_matricula_origem_id uuid,p_ano_destino_id uuid,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $func$
DECLARE
 v_actor uuid := auth.uid();
 v_m record;
 v_target record;
 v_auth record;
BEGIN
 IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
   RAISE EXCEPTION 'AUTH: escola fora do tenant ativo' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.escola_users eu
   WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
     AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola',
                      'staff_admin','diretor','secretaria_financeiro','admin_financeiro')
 ) THEN
   RAISE EXCEPTION 'AUTH: apenas balcão autorizado pode confirmar fora do prazo'
     USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
   RAISE EXCEPTION 'DATA: justificação obrigatória de 12 a 500 caracteres'
     USING ERRCODE='22023';
 END IF;
 SELECT m.aluno_id,m.ano_letivo,m.status,m.ativo INTO v_m
 FROM public.matriculas m
 WHERE m.escola_id=p_escola_id AND m.id=p_matricula_origem_id;
 IF NOT FOUND OR v_m.status NOT IN ('ativo','pendente','concluido','transferido') THEN
   RAISE EXCEPTION 'REMATRICULA_SOURCE_INVALID: matrícula de origem inválida'
     USING ERRCODE='23514';
 END IF;
 SELECT y.id,y.ano,y.ativo INTO v_target
 FROM public.anos_letivos y WHERE y.escola_id=p_escola_id AND y.id=p_ano_destino_id;
 IF NOT FOUND OR v_target.ativo IS DISTINCT FROM true
   OR v_target.ano IS DISTINCT FROM v_m.ano_letivo+1 THEN
   RAISE EXCEPTION 'REMATRICULA_TARGET_INVALID: destino deve ser ano ativo seguinte'
     USING ERRCODE='23514';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.rematricula_janelas j
   WHERE j.escola_id=p_escola_id AND j.ano_letivo=v_target.ano
     AND j.ativa=true AND now() BETWEEN j.data_inicio AND j.data_fim
 ) THEN
   RAISE EXCEPTION 'REMATRICULA_WINDOW_OPEN: a janela está aberta, não é necessária exceção'
     USING ERRCODE='23514';
 END IF;
 INSERT INTO public.balcao_late_reenroll_authorizations(
   escola_id,matricula_origem_id,ano_destino_id,actor_id,motivo,
   expires_at,used_at)
 VALUES (p_escola_id,p_matricula_origem_id,p_ano_destino_id,v_actor,
         btrim(p_motivo),now()+interval '30 minutes',NULL)
 ON CONFLICT (escola_id,matricula_origem_id,ano_destino_id,actor_id)
 DO UPDATE SET motivo=EXCLUDED.motivo,expires_at=EXCLUDED.expires_at,
   used_at=NULL,created_at=now()
 RETURNING id,expires_at,motivo INTO v_auth;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
 VALUES(p_escola_id,v_actor,'BALCAO_REMATRICULA_FORA_PRAZO_AUTORIZADA',
        'matriculas',p_matricula_origem_id::text,'secretaria',
        jsonb_build_object('autorizacao_id',v_auth.id,'motivo',v_auth.motivo,
         'ano_destino',v_target.ano,'ano_destino_id',p_ano_destino_id,
         'aluno_id',v_m.aluno_id,'expira_em',v_auth.expires_at));
 RETURN jsonb_build_object('ok',true,'autorizacao_id',v_auth.id,
   'expira_em',v_auth.expires_at);
END;
$func$;
REVOKE ALL ON FUNCTION public.autorizar_rematricula_fora_prazo(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_rematricula_fora_prazo(uuid,uuid,uuid,text) TO authenticated;
COMMIT;
