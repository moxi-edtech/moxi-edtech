BEGIN;

-- =================================================================
-- RPC para Geração de Histórico Acadêmico Anual
--
-- OBJETIVO:
-- 1. Consolidar os resultados de um ano letivo de um aluno
--    nas tabelas `historico_anos` and `historico_disciplinas`.
-- 2. Garantir que o histórico seja um registro imutável e consistente
--    do que aconteceu no ano.
-- =================================================================

CREATE OR REPLACE FUNCTION public.gerar_historico_anual(
  p_matricula_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula record;
  v_historico_ano_id uuid;
  boletim_row record;
BEGIN
  -- 1. Buscar a matrícula para obter os dados chave
  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  -- 2. Inserir ou atualizar o registro principal do histórico do ano
  -- Usamos ON CONFLICT para garantir a idempotência
  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, turma_id, status_final)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.turma_id,
    v_matricula.status
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    status_final = EXCLUDED.status_final,
    updated_at = now()
  RETURNING id INTO v_historico_ano_id;

  -- 3. Inserir ou atualizar as disciplinas e notas do histórico
  -- Lemos da nossa view de boletim (agora materializada) para obter os dados consolidados
  FOR boletim_row IN
    SELECT *
    FROM public.vw_boletim_por_matricula -- Lê da view que aponta para a MV
    WHERE matricula_id = p_matricula_id
  LOOP
    INSERT INTO public.historico_disciplinas (
      historico_ano_id,
      disciplina_id,
      disciplina_nome,
      nota_final,
      status_final,
      notas_detalhe
    )
    VALUES (
      v_historico_ano_id,
      boletim_row.disciplina_id,
      boletim_row.disciplina_nome,
      boletim_row.nota_final,
      CASE
        WHEN boletim_row.nota_final >= 9.5 THEN 'aprovado' -- Exemplo de regra de negócio
        ELSE 'reprovado'
      END,
      boletim_row.notas_por_tipo
    )
    ON CONFLICT (historico_ano_id, disciplina_id) DO UPDATE SET
      disciplina_nome = EXCLUDED.disciplina_nome,
      nota_final = EXCLUDED.nota_final,
      status_final = EXCLUDED.status_final,
      notas_detalhe = EXCLUDED.notas_detalhe,
      updated_at = now();
  END LOOP;

  -- 4. Auditoria
  -- A auditoria principal fica na função `finalizar_matricula_anual` que chama esta.
  -- No entanto, podemos adicionar um log específico se desejado.
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'HISTORICO_ANUAL_GERADO',
    'historico_anos',
    v_historico_ano_id::text,
    'system',
    jsonb_build_object(
      'matricula_id', p_matricula_id,
      'status_final_matricula', v_matricula.status
    )
  );
  
  RETURN v_historico_ano_id;
END;
$$;

ALTER FUNCTION public.gerar_historico_anual(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.gerar_historico_anual(uuid) TO authenticated;

COMMIT;
