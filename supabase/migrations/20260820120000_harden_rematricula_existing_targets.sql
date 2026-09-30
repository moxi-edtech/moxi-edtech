BEGIN;

-- Matrículas do ano destino criadas por promoção/virada já encerraram a
-- matrícula de origem como transferida. Isso não é uma transferência escolar:
-- é o estado histórico da transição para o destino. Só aceitamos esse estado
-- quando a matrícula destino já existe para o mesmo aluno e turma solicitada.
CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_matricula_origem_id uuid,
  p_ano_letivo_id uuid,
  p_destino_turma_id uuid,
  p_pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano_destino int;
  v_turma record;
  v_origem record;
  v_destino record;
  v_ocupacao int;
  v_criada boolean := false;
  v_classe_origem record;
  v_classe_destino record;
  v_numero_origem int;
  v_numero_destino int;
  v_numero_matricula bigint;
  v_reprovado boolean := false;
  v_raa jsonb;
  v_decision text;
BEGIN
  SELECT al.ano INTO v_ano_destino
  FROM public.anos_letivos al
  WHERE al.id = p_ano_letivo_id
    AND al.escola_id = p_escola_id
    AND al.ativo = true;
  IF v_ano_destino IS NULL THEN RAISE EXCEPTION 'Ano letivo destino inválido'; END IF;

  SELECT t.id, t.session_id, t.ano_letivo, t.capacidade_maxima, t.status_fecho
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id
    AND t.escola_id = p_escola_id
    AND t.session_id = p_ano_letivo_id
    AND t.ano_letivo = v_ano_destino;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'Turma destino não pertence ao ano letivo seleccionado'; END IF;
  IF lower(coalesce(v_turma.status_fecho, 'aberto')) NOT IN ('aberto', 'open', '') THEN RAISE EXCEPTION 'Turma destino está fechada'; END IF;

  SELECT m.* INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
  FOR UPDATE;
  IF v_origem.id IS NULL THEN RAISE EXCEPTION 'Matrícula de origem não encontrada'; END IF;
  IF v_origem.ano_letivo IS NULL OR v_origem.ano_letivo >= v_ano_destino THEN RAISE EXCEPTION 'Matrícula de origem não é de um ano anterior'; END IF;

  SELECT m.* INTO v_destino
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_ano_letivo_id
    AND m.ano_letivo = v_ano_destino
  ORDER BY CASE WHEN lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active') THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF lower(coalesce(v_origem.status, '')) NOT IN ('ativo', 'ativa', 'active', 'pendente', 'aprovado', 'aprovada') THEN
    IF lower(coalesce(v_origem.status, '')) <> 'transferido'
       OR v_destino.id IS NULL
       OR v_destino.turma_id IS DISTINCT FROM p_destino_turma_id THEN
      RAISE EXCEPTION 'Matrícula de origem não está elegível para rematrícula';
    END IF;
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_origem.id);
  v_decision := v_raa->>'decision';
  IF v_decision IN ('pendente', 'recurso', 'concluiu') OR v_decision IS NULL THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_BLOCKED: decisão % não autoriza concluir a rematrícula', v_decision;
  END IF;
  v_reprovado := v_decision IN ('retido', 'retido_por_faltas', 'retido_por_indisciplina');

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_origem
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = v_origem.turma_id AND t.escola_id = p_escola_id;
  v_numero_origem := COALESCE(v_classe_origem.numero,
    NULLIF((regexp_match(COALESCE(v_classe_origem.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_destino.id IS NULL THEN
    SELECT count(*)::int INTO v_ocupacao
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_destino_turma_id
      AND m.session_id = p_ano_letivo_id
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active');
    IF v_turma.capacidade_maxima IS NOT NULL AND v_ocupacao >= v_turma.capacidade_maxima THEN RAISE EXCEPTION 'Turma destino sem vagas'; END IF;

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
      status, ativo, created_at, data_matricula, data_inicio_financeiro,
      origem_transicao_matricula_id
    ) VALUES (
      gen_random_uuid(), p_escola_id, p_aluno_id, p_destino_turma_id,
      p_ano_letivo_id, v_ano_destino, 'pendente', false, now(), CURRENT_DATE,
      CURRENT_DATE, p_matricula_origem_id
    ) RETURNING * INTO v_destino;
    v_criada := true;
  ELSE
    UPDATE public.matriculas
       SET turma_id = p_destino_turma_id,
           session_id = p_ano_letivo_id,
           ano_letivo = v_ano_destino,
           data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
           origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, p_matricula_origem_id)
     WHERE id = v_destino.id;
    SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;
  END IF;

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_destino
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id;
  v_numero_destino := COALESCE(v_classe_destino.numero,
    NULLIF((regexp_match(COALESCE(v_classe_destino.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_numero_origem IS NOT NULL AND v_numero_destino IS NOT NULL THEN
    IF v_numero_origem = 12 AND NOT v_reprovado THEN RAISE EXCEPTION 'Aluno da 12ª classe não tem classe seguinte para rematrícula'; END IF;
    IF v_numero_destino <> (CASE WHEN v_reprovado THEN v_numero_origem ELSE v_numero_origem + 1 END) THEN RAISE EXCEPTION 'Turma destino inválida: a progressão RAA deve ser sequencial'; END IF;
  END IF;
  IF v_classe_origem.curso_id IS NOT NULL AND v_classe_destino.curso_id IS NOT NULL AND v_classe_origem.curso_id <> v_classe_destino.curso_id THEN
    RAISE EXCEPTION 'Turma destino pertence a outro curso';
  END IF;

  IF lower(coalesce(v_destino.status, '')) NOT IN ('ativo', 'ativa', 'active')
     OR v_destino.numero_matricula IS NULL OR btrim(v_destino.numero_matricula::text) = '' THEN
    v_numero_matricula := public.confirmar_matricula_core(p_aluno_id, v_ano_destino, p_destino_turma_id, v_destino.id);
  END IF;

  UPDATE public.matriculas
     SET status = 'ativo', ativo = true, turma_id = p_destino_turma_id,
         session_id = p_ano_letivo_id, ano_letivo = v_ano_destino, updated_at = now()
   WHERE id = v_destino.id;
  SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;

  UPDATE public.matriculas
     SET status = 'transferido', motivo_fecho = 'Rematrícula concluída no ano letivo destino',
         data_fecho = coalesce(data_fecho, now())
   WHERE id = p_matricula_origem_id AND id <> v_destino.id;

  UPDATE public.servico_pedidos
     SET status = 'granted', matricula_id = v_destino.id,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'matricula_destino_id', v_destino.id,
           'ano_letivo_id', p_ano_letivo_id,
           'destino_turma_id', p_destino_turma_id,
           'matricula_criada', v_criada,
           'raa_decision', v_decision
         )
   WHERE id = p_pedido_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de rematrícula não encontrado'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'matricula_id', v_destino.id,
    'numero_matricula', v_destino.numero_matricula,
    'turma_id', p_destino_turma_id, 'ano_letivo_id', p_ano_letivo_id,
    'matricula_criada', v_criada, 'raa', v_raa
  );
END;
$$;

COMMIT;
