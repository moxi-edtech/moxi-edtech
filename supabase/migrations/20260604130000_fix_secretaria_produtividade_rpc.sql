BEGIN;

CREATE OR REPLACE FUNCTION public.get_secretaria_produtividade_hoje(p_escola_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admissoes_hoje int;
  v_atividades_recentes jsonb;
  v_alertas_cadastro jsonb;
  v_aniversariantes jsonb;
  v_devedores_criticos jsonb;
  v_candidaturas_pendentes jsonb;
  v_total_fichas_incompletas int;
  v_uid uuid;
BEGIN
  -- Permite execução via service_role onde auth.uid() é nulo
  v_uid := auth.uid();

  -- 1. Minhas Admissões Hoje
  SELECT COUNT(DISTINCT entity_id) INTO v_admissoes_hoje
  FROM public.audit_logs
  WHERE escola_id = p_escola_id 
    AND (v_uid IS NULL OR actor_id = v_uid) 
    AND entity = 'matriculas' 
    AND action IN ('CREATE', 'ADMISSAO_CONCLUIDA', 'MATRICULA_VALIDADA')
    AND created_at >= (now() AT TIME ZONE 'Africa/Luanda')::date;

  -- 2. Minhas Atividades Recentes
  SELECT jsonb_agg(row_to_json(t)) INTO v_atividades_recentes
  FROM (
    WITH base_logs AS (
      SELECT id, created_at, action, entity, entity_id, details, after,
             (CASE WHEN entity = 'pagamentos' THEN (after->>'aluno_id') WHEN entity = 'documentos_emitidos' THEN (after->>'aluno_id') ELSE (details->>'aluno_id') END)::uuid as v_aluno_id,
             (CASE WHEN entity = 'pagamentos' THEN (after->>'matricula_id') WHEN entity = 'matriculas' THEN entity_id ELSE NULL END)::uuid as v_matricula_id
      FROM public.audit_logs
      WHERE escola_id = p_escola_id 
        AND (v_uid IS NULL OR actor_id = v_uid) 
        AND entity IN ('matriculas', 'pagamentos', 'candidaturas', 'frequencia', 'documentos_emitidos', 'notas')
      ORDER BY created_at DESC LIMIT 5
    )
    SELECT
      bl.id, bl.created_at, bl.action, bl.entity, bl.entity_id,
      COALESCE(al.nome, bl.details->>'aluno_nome', bl.after->>'aluno_nome', 'Sistema') as aluno_nome,
      al.bi_numero as aluno_bi, tu.nome as turma_nome,
      CASE
        WHEN bl.entity = 'candidaturas' THEN 'Candidatura'
        WHEN bl.entity = 'pagamentos' OR bl.action = 'PAGAMENTO_REGISTRADO' THEN
           (SELECT 'Propina ' || CASE WHEN m.mes_referencia IS NOT NULL THEN to_char(make_date(2000, m.mes_referencia, 1), 'TMMon') || '/' || m.ano_referencia ELSE 'Avulsa' END FROM public.mensalidades m WHERE m.id = CASE WHEN bl.entity = 'pagamentos' THEN (bl.after->>'mensalidade_id')::uuid ELSE bl.entity_id::uuid END LIMIT 1)
        WHEN bl.entity = 'matriculas' THEN 'Matrícula'
        WHEN bl.entity = 'documentos_emitidos' THEN COALESCE(bl.after->>'tipo_documento', 'Documento')
        WHEN bl.action = 'NOTA_LANCADA_BATCH' THEN 'Lançamento de Notas'
        WHEN bl.action = 'FREQUENCIA_UPSERT_BATCH' THEN 'Registo de Frequências'
        ELSE NULL
      END as contexto,
      COALESCE((bl.details->>'valor_pago')::numeric, (bl.after->>'valor_pago')::numeric) as valor_pago
    FROM base_logs bl
    LEFT JOIN public.alunos al ON al.id = bl.v_aluno_id
    LEFT JOIN public.matriculas ma ON ma.id = bl.v_matricula_id
    LEFT JOIN public.turmas tu ON tu.id = ma.turma_id
    ORDER BY bl.created_at DESC
  ) t;

  -- 3. Candidaturas Pendentes
  SELECT jsonb_agg(cand) INTO v_candidaturas_pendentes
  FROM (
    SELECT
      c.id as candidatura_id, 'Nova Candidatura' as titulo, c.nome_candidato || ' aguarda validação.' as resumo, c.created_at as data,
      'Validar Admissão' as action_label, 'CANDIDATURA_PENDENTE' as type,
      p.reason as priority_note,
      (p.id IS NOT NULL) as is_priority
    FROM public.candidaturas c
    LEFT JOIN public.secretaria_prioridades p ON p.escola_id = p_escola_id AND p.entity = 'candidaturas' AND p.entity_id = c.id AND p.resolved_at IS NULL
    WHERE c.escola_id = p_escola_id AND c.status = 'pendente'
      AND (v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.secretaria_avisos_snooze s WHERE s.user_id = v_uid AND s.aviso_id = c.id::text AND s.aviso_type = 'CANDIDATURA_PENDENTE' AND s.snoozed_until > now()))
    ORDER BY is_priority DESC, c.created_at DESC LIMIT 10
  ) cand;

  -- 4. Fichas Incompletas
  SELECT jsonb_agg(a_list) INTO v_alertas_cadastro
  FROM (
    SELECT
      al.id as aluno_id, 'Ficha Incompleta' as titulo, al.nome || ': Dados em falta' as resumo, m.created_at as data,
      'Completar Ficha' as action_label, 'FICHA_RAPIDA' as type,
      p.reason as priority_note,
      (p.id IS NOT NULL) as is_priority
    FROM public.matriculas m
    JOIN public.alunos al ON al.id = m.aluno_id
    LEFT JOIN public.secretaria_prioridades p ON p.escola_id = p_escola_id AND p.entity = 'alunos' AND p.entity_id = al.id AND p.resolved_at IS NULL
    WHERE m.escola_id = p_escola_id AND m.status IN ('ativo', 'ativa')
      AND (al.bi_numero IS NULL OR al.bi_numero = '' OR al.data_nascimento IS NULL OR al.pai_nome IS NULL OR al.mae_nome IS NULL)
      AND (v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.secretaria_avisos_snooze s WHERE s.user_id = v_uid AND s.aviso_id = al.id::text AND s.aviso_type = 'FICHA_RAPIDA' AND s.snoozed_until > now()))
    ORDER BY is_priority DESC, m.created_at DESC LIMIT 10
  ) a_list;

  -- 5. Aniversariantes
  SELECT jsonb_agg(ani) INTO v_aniversariantes
  FROM (
    SELECT
      a.id as aluno_id, 'Aniversário Hoje!' as titulo, 'O aluno ' || a.nome || ' completa anos hoje.' as resumo, now() as data,
      'Dar Parabéns' as action_label, 'BIRTHDAY_WHATSAPP' as type, COALESCE(a.telefone_responsavel, a.telefone) as telefone_whatsapp, a.nome as nome_aluno,
      p.reason as priority_note, (p.id IS NOT NULL) as is_priority
    FROM public.alunos a JOIN public.matriculas m ON m.aluno_id = a.id
    LEFT JOIN public.secretaria_prioridades p ON p.escola_id = p_escola_id AND p.entity = 'alunos' AND p.entity_id = a.id AND p.resolved_at IS NULL
    WHERE a.escola_id = p_escola_id AND m.status IN ('ativo', 'ativa')
      AND EXTRACT(MONTH FROM a.data_nascimento) = EXTRACT(MONTH FROM (now() AT TIME ZONE 'Africa/Luanda'))
      AND EXTRACT(DAY FROM a.data_nascimento) = EXTRACT(DAY FROM (now() AT TIME ZONE 'Africa/Luanda'))
      AND (v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.secretaria_avisos_snooze s WHERE s.user_id = v_uid AND s.aviso_id = a.id::text AND s.aviso_type = 'BIRTHDAY_WHATSAPP' AND s.snoozed_until > now()))
    LIMIT 10
  ) ani;

  -- 6. Devedores Críticos
  SELECT jsonb_agg(dev) INTO v_devedores_criticos
  FROM (
    SELECT
      a.id as aluno_id, 'Dívida Crítica' as titulo, a.nome || ' tem ' || COUNT(*) || ' meses em atraso.' as resumo, now() as data,
      'Abrir Pagamento' as action_label, 'DEBT_PAYMENT' as type, SUM(men.valor_previsto - COALESCE(men.valor_pago_total, 0)) as total_divida,
      p.reason as priority_note, (p.id IS NOT NULL) as is_priority
    FROM public.alunos a JOIN public.mensalidades men ON men.aluno_id = a.id
    LEFT JOIN public.secretaria_prioridades p ON p.escola_id = p_escola_id AND p.entity = 'alunos' AND p.entity_id = a.id AND p.resolved_at IS NULL
    WHERE a.escola_id = p_escola_id AND men.status IN ('pendente', 'pago_parcial') AND men.data_vencimento < (now() AT TIME ZONE 'Africa/Luanda')::date
    GROUP BY a.id, a.nome, p.id, p.reason HAVING COUNT(*) >= 3
    ORDER BY is_priority DESC, a.nome ASC LIMIT 10
  ) dev;

  -- 7. Contagem Total
  SELECT COUNT(*) INTO v_total_fichas_incompletas
  FROM public.matriculas m JOIN public.alunos al ON al.id = m.aluno_id
  WHERE m.escola_id = p_escola_id AND m.status IN ('ativo', 'ativa')
    AND (al.bi_numero IS NULL OR al.bi_numero = '' OR al.data_nascimento IS NULL);

  RETURN jsonb_build_object(
    'ok', true,
    'admissoes_hoje', COALESCE(v_admissoes_hoje, 0),
    'atividades_recentes', COALESCE(v_atividades_recentes, '[]'::jsonb),
    'documentos_pendentes', COALESCE(v_total_fichas_incompletas, 0),
    'alertas_notificacoes',
       COALESCE(v_candidaturas_pendentes, '[]'::jsonb) ||
       COALESCE(v_alertas_cadastro, '[]'::jsonb) ||
       COALESCE(v_aniversariantes, '[]'::jsonb) ||
       COALESCE(v_devedores_criticos, '[]'::jsonb)
  );
END;
$function$;

COMMIT;
