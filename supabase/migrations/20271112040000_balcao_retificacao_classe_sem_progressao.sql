-- BALCAO: explicit correction of a mistaken current-year class, not promotion.
-- Reuses the installed retificar_classe_matricula and the protected one-student
-- nonce used by the transfer guards. No enrollment, payment or academic record is created.
-- Requires the earlier balcao_pauta_turma_correction_nonce migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.turma_transfer_academic_evidence_v1(
  p_matricula_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $preflight$
DECLARE
  v_actor uuid := auth.uid();
  v_escola uuid := public.current_tenant_escola_id();
  v_m public.matriculas%ROWTYPE;
  v_blocked boolean;
BEGIN
  IF v_actor IS NULL OR v_escola IS NULL OR NOT coalesce(
    public.user_has_role_in_school(
      v_escola, ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']
    ), false
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Sem permissão para consultar transferências académicas.';
  END IF;
  SELECT * INTO v_m FROM public.matriculas
    WHERE id=p_matricula_id AND escola_id=v_escola;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0002',
      MESSAGE='Matrícula não encontrada nesta escola.';
  END IF;
  SELECT (
    EXISTS (SELECT 1 FROM public.notas WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.exame_resultados WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.frequencias WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.frequencia_status_periodo WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR public.turma_transfer_has_secondary_evidence_v1(
         v_escola, v_m.id, v_m.turma_id, v_m.aluno_id, v_m.ano_letivo)
  ) INTO v_blocked;
  RETURN jsonb_build_object(
    'has_evidence', v_blocked,
    'requires_reconciliation', v_blocked
  );
END;
$preflight$;
REVOKE ALL ON FUNCTION public.turma_transfer_academic_evidence_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turma_transfer_academic_evidence_v1(uuid)
  TO authenticated;

-- Explicit administrative correction, not academic progression.
CREATE OR REPLACE FUNCTION public.retificar_classe_matricula(p_matricula_id uuid, p_turma_destino_id uuid, p_motivo text, p_confirmar_historico boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_escola uuid := public.current_tenant_escola_id();
 v_m public.matriculas%ROWTYPE;
 v_origem public.turmas%ROWTYPE;
 v_destino public.turmas%ROWTYPE;
 v_motivo text := nullif(btrim(p_motivo),'');
 v_historico jsonb;
 v_historico_apos jsonb;
 v_m_apos public.matriculas%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR v_escola IS NULL OR NOT coalesce(public.user_has_role_in_school(v_escola,ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']),false)
 THEN RAISE EXCEPTION 'AUTH: Sem permissão para corrigir esta matrícula.'; END IF;
 IF v_motivo IS NULL OR length(v_motivo) NOT BETWEEN 10 AND 300 THEN RAISE EXCEPTION 'DATA: Motivo deve ter entre 10 e 300 caracteres.'; END IF;
 SELECT * INTO v_m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=v_escola FOR UPDATE;
 IF NOT FOUND OR v_m.ativo IS DISTINCT FROM true OR public.canonicalize_matricula_status_text(v_m.status) <> 'ativo' THEN RAISE EXCEPTION 'DATA: Matrícula inativa ou inexistente.'; END IF;
 SELECT * INTO v_origem FROM public.turmas WHERE id=v_m.turma_id AND escola_id=v_escola;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Turma atual inválida.'; END IF;
 SELECT * INTO v_destino FROM public.turmas WHERE id=p_turma_destino_id AND escola_id=v_escola FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Turma destino inválida.'; END IF;
 IF v_origem.classe_id IS NOT DISTINCT FROM v_destino.classe_id THEN RAISE EXCEPTION 'DATA: Use transferência de turma para a mesma classe.'; END IF;
 IF v_origem.ano_letivo IS DISTINCT FROM v_destino.ano_letivo OR v_origem.session_id IS DISTINCT FROM v_destino.session_id
 THEN RAISE EXCEPTION 'DATA: As turmas devem pertencer ao mesmo ano e sessão.'; END IF;
 IF v_destino.capacidade_maxima IS NULL OR v_destino.capacidade_maxima <= 0 THEN RAISE EXCEPTION 'DATA: Configure a capacidade da turma destino.'; END IF;
 IF (SELECT count(*) FROM public.matriculas m WHERE m.turma_id=v_destino.id AND m.escola_id=v_escola AND public.canonicalize_matricula_status_text(m.status)='ativo') >= v_destino.capacidade_maxima
 THEN RAISE EXCEPTION 'DATA: Turma sem vagas.'; END IF;
 -- Corrigir matrícula não é progressão: apenas o ano atualmente ativo,
 -- sem alterar ligações de turma para avaliações ou pautas já emitidas.
 IF v_m.session_id IS NULL OR v_m.session_id IS DISTINCT FROM v_origem.session_id
    OR v_m.ano_letivo IS DISTINCT FROM v_origem.ano_letivo
    OR v_destino.ano_letivo_id IS DISTINCT FROM v_destino.session_id
    OR v_origem.status_validacao IS DISTINCT FROM 'ativo'
    OR v_destino.status_validacao IS DISTINCT FROM 'ativo'
    OR NOT EXISTS (SELECT 1 FROM public.anos_letivos y
                   WHERE y.id=v_m.session_id AND y.escola_id=v_escola
                     AND y.ativo IS TRUE AND y.ano=v_m.ano_letivo)
 THEN RAISE EXCEPTION 'DATA: Matrícula ou turmas não pertencem ao ano ativo.'; END IF;
 IF coalesce((public.turma_transfer_academic_evidence_v1(v_m.id)->>'has_evidence')::boolean,true)
 THEN RAISE EXCEPTION 'HISTORICO: Existem notas, pautas ou frequência. Regularize antes de corrigir a classe.'
   USING ERRCODE='P1050'; END IF;
 -- Existing records stay intact and retain their original references.
 SELECT jsonb_build_object(
  'notas',(SELECT count(*) FROM public.notas WHERE matricula_id=v_m.id),
  'avaliacoes',(SELECT count(*) FROM public.notas_avaliacoes WHERE matricula_id=v_m.id),
  'pedidos_melhoria',(SELECT count(*) FROM public.melhoria_nota_pedidos WHERE matricula_id=v_m.id),
  'pautas_turma_origem',(SELECT count(*) FROM public.pautas_oficiais WHERE turma_id=v_origem.id),
  'pagamentos',(SELECT count(*) FROM public.pagamentos WHERE aluno_id=v_m.aluno_id AND escola_id=v_escola),
  'cobrancas',(SELECT count(*) FROM public.financeiro_cobrancas WHERE aluno_id=v_m.aluno_id AND escola_id=v_escola),
  'mensalidades',(SELECT count(*) FROM public.mensalidades WHERE matricula_id=v_m.id),
  'contratos',(SELECT count(*) FROM public.financeiro_contratos WHERE matricula_id=v_m.id),
  'lancamentos',(SELECT count(*) FROM public.financeiro_lancamentos WHERE matricula_id=v_m.id),
  'exames',(SELECT count(*) FROM public.exame_resultados WHERE matricula_id=v_m.id),
  'frequencia',(SELECT count(*) FROM public.frequencia_status_periodo WHERE matricula_id=v_m.id)
 ) INTO v_historico;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v_historico) AS h(k,v) WHERE v::integer>0) AND NOT coalesce(p_confirmar_historico,false)
 THEN RAISE EXCEPTION 'CONFIRMACAO: Revise o histórico e confirme a preservação dos registos anteriores.'; END IF;
 -- Contexto temporário acessível só à função, eliminado na mesma transação.
 -- Os guards globais preservam as regras para qualquer outro UPDATE.
 INSERT INTO public.balcao_pauta_turma_correction_nonce(
   escola_id,matricula_id,actor_id,turma_origem_id,turma_destino_id
 ) VALUES(v_escola,v_m.id,auth.uid(),v_origem.id,v_destino.id);
 UPDATE public.matriculas SET turma_id=v_destino.id, updated_at=now(), updated_by=auth.uid() WHERE id=v_m.id AND escola_id=v_escola;
 DELETE FROM public.balcao_pauta_turma_correction_nonce
 WHERE escola_id=v_escola AND matricula_id=v_m.id AND actor_id=auth.uid();

 -- Transactional postconditions: any broken link aborts the correction and rolls back.
 SELECT * INTO v_m_apos FROM public.matriculas WHERE id=v_m.id AND escola_id=v_escola;
 IF NOT FOUND OR v_m_apos.aluno_id IS DISTINCT FROM v_m.aluno_id
   OR v_m_apos.session_id IS DISTINCT FROM v_m.session_id
   OR v_m_apos.ano_letivo IS DISTINCT FROM v_m.ano_letivo
   OR v_m_apos.data_inicio_financeiro IS DISTINCT FROM v_m.data_inicio_financeiro
   OR v_m_apos.turma_id IS DISTINCT FROM v_destino.id
 THEN RAISE EXCEPTION 'INTEGRIDADE: matrícula, aluno ou contexto académico alterado indevidamente.'; END IF;
 SELECT jsonb_build_object(
  'notas',(SELECT count(*) FROM public.notas WHERE matricula_id=v_m.id),
  'avaliacoes',(SELECT count(*) FROM public.notas_avaliacoes WHERE matricula_id=v_m.id),
  'pedidos_melhoria',(SELECT count(*) FROM public.melhoria_nota_pedidos WHERE matricula_id=v_m.id),
  'pautas_turma_origem',(SELECT count(*) FROM public.pautas_oficiais WHERE turma_id=v_origem.id),
  'pagamentos',(SELECT count(*) FROM public.pagamentos WHERE aluno_id=v_m.aluno_id AND escola_id=v_escola),
  'cobrancas',(SELECT count(*) FROM public.financeiro_cobrancas WHERE aluno_id=v_m.aluno_id AND escola_id=v_escola),
  'mensalidades',(SELECT count(*) FROM public.mensalidades WHERE matricula_id=v_m.id),
  'contratos',(SELECT count(*) FROM public.financeiro_contratos WHERE matricula_id=v_m.id),
  'lancamentos',(SELECT count(*) FROM public.financeiro_lancamentos WHERE matricula_id=v_m.id),
  'exames',(SELECT count(*) FROM public.exame_resultados WHERE matricula_id=v_m.id),
  'frequencia',(SELECT count(*) FROM public.frequencia_status_periodo WHERE matricula_id=v_m.id)
 ) INTO v_historico_apos;
 IF v_historico_apos IS DISTINCT FROM v_historico THEN
  RAISE EXCEPTION 'INTEGRIDADE: alteração inesperada nos vínculos académicos ou financeiros.';
 END IF;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details,before,after)
 VALUES(v_escola,auth.uid(),'MATRICULA_CLASSE_RETIFICADA','matriculas',v_m.id::text,'secretaria',jsonb_build_object('motivo',v_motivo,'tipo','retificacao_classe','historico_preservado',v_historico,'matricula_id_preservado',v_m.id,'aluno_id_preservado',v_m.aluno_id,'sessao_preservada',v_m.session_id,'confirmacao_historico',p_confirmar_historico),jsonb_build_object('turma_id',v_origem.id,'classe_id',v_origem.classe_id),jsonb_build_object('turma_id',v_destino.id,'classe_id',v_destino.classe_id));
 RETURN v_m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.retificar_classe_matricula(uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.retificar_classe_matricula(uuid,uuid,text,boolean) TO authenticated;

COMMIT;
