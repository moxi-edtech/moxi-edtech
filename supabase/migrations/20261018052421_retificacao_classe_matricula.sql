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
 IF auth.uid() IS NULL OR v_escola IS NULL OR NOT coalesce(public.user_has_role_in_school(v_escola,ARRAY['admin','admin_escola']),false)
 THEN RAISE EXCEPTION 'AUTH: Apenas o administrador da escola pode retificar a classe.'; END IF;
 IF v_motivo IS NULL OR length(v_motivo) NOT BETWEEN 10 AND 300 THEN RAISE EXCEPTION 'DATA: Motivo deve ter entre 10 e 300 caracteres.'; END IF;
 SELECT * INTO v_m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=v_escola FOR UPDATE;
 IF NOT FOUND OR public.canonicalize_matricula_status_text(v_m.status) <> 'ativo' THEN RAISE EXCEPTION 'DATA: Matrícula inativa ou inexistente.'; END IF;
 SELECT * INTO v_origem FROM public.turmas WHERE id=v_m.turma_id AND escola_id=v_escola;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Turma atual inválida.'; END IF;
 SELECT * INTO v_destino FROM public.turmas WHERE id=p_turma_destino_id AND escola_id=v_escola FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DATA: Turma destino inválida.'; END IF;
 IF v_origem.classe_id IS NOT DISTINCT FROM v_destino.classe_id THEN RAISE EXCEPTION 'DATA: Use transferência de turma para a mesma classe.'; END IF;
 IF v_origem.ano_letivo IS DISTINCT FROM v_destino.ano_letivo OR v_origem.session_id IS DISTINCT FROM v_destino.session_id OR v_origem.curso_id IS DISTINCT FROM v_destino.curso_id
 THEN RAISE EXCEPTION 'DATA: Ano letivo, sessão e curso devem ser iguais.'; END IF;
 IF v_destino.capacidade_maxima > 0 AND (SELECT count(*) FROM public.matriculas m WHERE m.turma_id=v_destino.id AND m.escola_id=v_escola AND public.canonicalize_matricula_status_text(m.status)='ativo') >= v_destino.capacidade_maxima
 THEN RAISE EXCEPTION 'DATA: Turma sem vagas.'; END IF;
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
 UPDATE public.matriculas SET turma_id=v_destino.id, updated_at=now(), updated_by=auth.uid() WHERE id=v_m.id AND escola_id=v_escola;
 -- Transactional postconditions: any broken link aborts the correction and rolls back.
 SELECT * INTO v_m_apos FROM public.matriculas WHERE id=v_m.id AND escola_id=v_escola;
 IF NOT FOUND OR v_m_apos.aluno_id IS DISTINCT FROM v_m.aluno_id
   OR v_m_apos.session_id IS DISTINCT FROM v_m.session_id
   OR v_m_apos.ano_letivo IS DISTINCT FROM v_m.ano_letivo
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
