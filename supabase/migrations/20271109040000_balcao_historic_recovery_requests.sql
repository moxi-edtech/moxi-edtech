-- Student-scoped request to the school's academic authority from the Balcao.
-- Financial roles can request intervention, never create grades or certify an outcome.
BEGIN;

CREATE TABLE public.balcao_historic_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  solicitante_id uuid NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 12 AND 500),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX balcao_historic_recovery_one_pending_idx
  ON public.balcao_historic_recovery_requests (escola_id,matricula_id)
  WHERE status='pendente';
CREATE INDEX balcao_historic_recovery_pending_school_idx
  ON public.balcao_historic_recovery_requests (escola_id,created_at DESC)
  WHERE status='pendente';

ALTER TABLE public.balcao_historic_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balcao_historic_recovery_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.balcao_historic_recovery_requests TO authenticated;

CREATE POLICY balcao_historic_recovery_school_read ON public.balcao_historic_recovery_requests
  FOR SELECT TO authenticated USING (
    escola_id=public.current_tenant_escola_id()
    AND EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=balcao_historic_recovery_requests.escola_id
        AND eu.user_id=(SELECT auth.uid())
        AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola',
                         'staff_admin','diretor','admin_financeiro','secretaria_financeiro')
    )
  );

CREATE OR REPLACE FUNCTION public.solicitar_regularizacao_historica_balcao(
  p_escola_id uuid,p_matricula_id uuid,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_aluno uuid;
  v_request_id uuid;
  v_created boolean := false;
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola fora do tenant ativo' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
      AND eu.user_id=v_actor
      AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola',
                       'staff_admin','diretor','admin_financeiro','secretaria_financeiro')
  ) THEN
    RAISE EXCEPTION 'AUTH: perfil sem acesso ao atendimento académico' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'DATA: indique o motivo da solicitação (12-500 caracteres)' USING ERRCODE='22023';
  END IF;

  SELECT m.aluno_id INTO v_aluno
  FROM public.matriculas m
  JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=m.escola_id
    AND y.ano=m.ano_letivo AND y.ativo=false
  WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
    AND m.ativo=false
    AND (
      (m.status='pendente' AND coalesce(m.status_fecho_origem,'manual')='manual')
      OR (m.status='concluido' AND m.status_fecho_origem='override_admin'
          AND EXISTS (
            SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id=p_escola_id AND h.matricula_id=m.id
              AND h.snapshot_status='aberto'
          ))
    )
    AND EXISTS (
      SELECT 1 FROM public.anos_letivos target
      WHERE target.escola_id=p_escola_id AND target.ativo=true
        AND target.ano=m.ano_letivo+1
    )
  FOR SHARE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACADEMIC_SOURCE_INVALID: origem não elegível para pedido de regularização'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.balcao_historic_recovery_requests
    (escola_id,matricula_id,aluno_id,solicitante_id,motivo)
  VALUES (p_escola_id,p_matricula_id,v_aluno,v_actor,btrim(p_motivo))
  ON CONFLICT (escola_id,matricula_id) WHERE status='pendente' DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NOT NULL THEN
    v_created := true;
    INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES (p_escola_id,v_actor,'BALCAO_REGULARIZACAO_ACADEMICA_SOLICITADA',
      'matriculas',p_matricula_id::text,'secretaria',
      jsonb_build_object('pedido_id',v_request_id,'aluno_id',v_aluno,
                         'motivo',btrim(p_motivo)));
  ELSE
    SELECT id INTO v_request_id FROM public.balcao_historic_recovery_requests
    WHERE escola_id=p_escola_id AND matricula_id=p_matricula_id
      AND status='pendente';
  END IF;
  RETURN jsonb_build_object('ok',true,'pedido_id',v_request_id,
                            'criado',v_created);
END;
$function$;

REVOKE ALL ON FUNCTION public.solicitar_regularizacao_historica_balcao(uuid,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.solicitar_regularizacao_historica_balcao(uuid,uuid,text)
  TO authenticated;
COMMIT;
