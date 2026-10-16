BEGIN;
-- Preserve matrícula identity (and therefore academic/financial foreign keys) while
-- recording an immutable audit trail in the same transaction.
CREATE OR REPLACE FUNCTION public.transferir_aluno_turma(
 p_matricula_origem_id uuid, p_turma_destino_id uuid, p_motivo text DEFAULT NULL::text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_escola_id uuid := public.current_tenant_escola_id();
 v_origem public.matriculas%ROWTYPE;
 v_source public.turmas%ROWTYPE;
 v_target public.turmas%ROWTYPE;
 v_motivo text := nullif(btrim(p_motivo), '');
BEGIN
 IF auth.uid() IS NULL OR v_escola_id IS NULL
 OR NOT coalesce(public.user_has_role_in_school(v_escola_id, ARRAY['secretaria','admin','admin_escola','staff_admin']),false)
 THEN RAISE EXCEPTION 'AUTH: Permissão negada.'; END IF;
 IF v_motivo IS NULL OR char_length(v_motivo) < 10 OR char_length(v_motivo) > 300
 THEN RAISE EXCEPTION 'DATA: Informe motivo de 10 a 300 caracteres.'; END IF;
 SELECT * INTO v_origem FROM public.matriculas
 WHERE id=p_matricula_origem_id AND escola_id=v_escola_id
 AND public.canonicalize_matricula_status_text(status)='ativo';
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Matrícula não encontrada ou inativa.'; END IF;
 SELECT * INTO v_source FROM public.turmas WHERE id=v_origem.turma_id AND escola_id=v_escola_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Turma de origem inválida.'; END IF;
 IF v_source.id=p_turma_destino_id THEN RAISE EXCEPTION 'DATA: Turma destino deve ser diferente.'; END IF;
 -- Lock both class rows in UUID order before the enrolment row. This provides
 -- a consistent lock hierarchy for transfers in either direction.
 PERFORM 1 FROM public.turmas t WHERE t.id IN (v_source.id,p_turma_destino_id)
 AND t.escola_id=v_escola_id ORDER BY t.id FOR UPDATE;
 SELECT * INTO v_target FROM public.turmas WHERE id=p_turma_destino_id AND escola_id=v_escola_id;
 IF v_target.id IS NULL THEN RAISE EXCEPTION 'DATA: Turma destino inválida.'; END IF;
 SELECT * INTO v_origem FROM public.matriculas
 WHERE id=p_matricula_origem_id AND escola_id=v_escola_id
 AND turma_id=v_source.id
 AND public.canonicalize_matricula_status_text(status)='ativo' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Matrícula foi alterada; recarregue antes de repetir.'; END IF;
 IF v_source.id=v_target.id THEN RAISE EXCEPTION 'DATA: Turma destino deve ser diferente.'; END IF;
 IF v_source.ano_letivo IS DISTINCT FROM v_target.ano_letivo OR
 v_source.classe_id IS DISTINCT FROM v_target.classe_id OR
 v_source.curso_id IS DISTINCT FROM v_target.curso_id
 THEN RAISE EXCEPTION 'DATA: Apenas turmas do mesmo ano letivo, classe e curso são compatíveis.'; END IF;
 IF v_source.session_id IS DISTINCT FROM v_target.session_id
 THEN RAISE EXCEPTION 'DATA: Sessões académicas diferentes. Requer regularização específica.'; END IF;
 IF v_target.capacidade_maxima > 0 AND
 (SELECT count(*) FROM public.matriculas m
  WHERE m.escola_id=v_escola_id AND m.turma_id=v_target.id
  AND public.canonicalize_matricula_status_text(m.status)='ativo') >= v_target.capacidade_maxima
 THEN RAISE EXCEPTION 'DATA: Turma destino sem vagas.'; END IF;
 UPDATE public.matriculas SET turma_id=v_target.id,updated_at=now(),updated_by=auth.uid()
 WHERE id=v_origem.id AND escola_id=v_escola_id;
 INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,portal,details,before,after)
 VALUES (v_escola_id,auth.uid(),'MATRICULA_TRANSFERIDA','matriculas',v_origem.id::text,
 'secretaria',jsonb_build_object('motivo',v_motivo,'tipo','correcao_turma'),
 jsonb_build_object('turma_id',v_source.id,'session_id',v_origem.session_id),
 jsonb_build_object('turma_id',v_target.id,'session_id',v_origem.session_id));
 RETURN v_origem.id;
END;
$$;
REVOKE ALL ON FUNCTION public.transferir_aluno_turma(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transferir_aluno_turma(uuid,uuid,text) TO authenticated;
COMMIT;
