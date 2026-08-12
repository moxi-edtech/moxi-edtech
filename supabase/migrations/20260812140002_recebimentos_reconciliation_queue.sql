-- Fila de recebimentos: filtros operacionais e reconciliação de comprovativos.
-- A view continua limitada a pagamentos pendentes; os campos adicionais tornam
-- a idade/prioridade explícitas para a secretaria e para o feed operacional.
DROP VIEW IF EXISTS public.vw_pagamentos_pendentes;

CREATE VIEW public.vw_pagamentos_pendentes
WITH (security_invoker = true) AS
WITH pending AS (
  SELECT
    p.id AS pagamento_id,
    p.escola_id,
    m.id AS mensalidade_id,
    m.aluno_id,
    COALESCE(a.nome_completo, a.nome) AS aluno_nome,
    COALESCE(t.turma_codigo, t.turma_code, t.nome) AS turma_codigo,
    CAST(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0) AS numeric(14,2)) AS valor_esperado,
    CAST(p.valor_pago AS numeric(14,2)) AS valor_enviado,
    p.evidence_url AS comprovante_url,
    p.reference,
    p.metodo,
    p.created_at,
    p.meta -> 'comprovativo' ->> 'mensagem_aluno' AS mensagem_aluno,
    'mensalidade'::text AS tipo_entidade,
    null::text AS servico_codigo,
    'Mensalidade Escolar'::text AS servico_nome
  FROM public.pagamentos p
  JOIN public.mensalidades m ON m.id = p.mensalidade_id
  JOIN public.alunos a ON a.id = m.aluno_id
  LEFT JOIN public.matriculas mat ON mat.id = m.matricula_id
  LEFT JOIN public.turmas t ON t.id = COALESCE(m.turma_id, mat.turma_id)
  WHERE p.status = 'pending'

  UNION ALL

  SELECT
    pi.id AS pagamento_id,
    pi.escola_id,
    null::uuid AS mensalidade_id,
    pi.aluno_id,
    COALESCE(a.nome_completo, a.nome) AS aluno_nome,
    COALESCE(t.turma_codigo, t.turma_code, t.nome) AS turma_codigo,
    CAST(pi.amount AS numeric(14,2)) AS valor_esperado,
    CAST(pi.amount AS numeric(14,2)) AS valor_enviado,
    pi.evidence_url AS comprovante_url,
    pi.reference,
    pi.method AS metodo,
    pi.created_at,
    pi.meta ->> 'mensagem_aluno' AS mensagem_aluno,
    'servico'::text AS tipo_entidade,
    sp.servico_codigo,
    sp.servico_nome
  FROM public.pagamento_intents pi
  JOIN public.alunos a ON a.id = pi.aluno_id
  JOIN public.servico_pedidos sp ON sp.id = pi.servico_pedido_id
  LEFT JOIN public.matriculas mat ON mat.aluno_id = a.id AND mat.escola_id = pi.escola_id AND mat.status = 'ativo'
  LEFT JOIN public.turmas t ON t.id = mat.turma_id
  WHERE pi.status = 'pending'
)
SELECT
  pending.*,
  CASE WHEN pending.comprovante_url IS NULL THEN 'sem_comprovativo' ELSE 'comprovativo_enviado' END AS estado_operacional,
  FLOOR(EXTRACT(EPOCH FROM (now() - pending.created_at)) / 3600)::integer AS idade_horas,
  CASE
    WHEN pending.created_at < now() - interval '48 hours' THEN 'urgente'
    WHEN pending.created_at < now() - interval '24 hours' THEN 'importante'
    ELSE 'normal'
  END AS prioridade
FROM pending;

GRANT SELECT ON public.vw_pagamentos_pendentes TO authenticated;
GRANT SELECT ON public.vw_pagamentos_pendentes TO service_role;

CREATE OR REPLACE FUNCTION public.reconciliar_pagamentos_pendentes(p_min_age_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.admin_activity_events (
    escola_id, occurred_at, event_type, event_family, entity_type, entity_id, payload, dedupe_key
  )
  SELECT
    q.escola_id,
    now(),
    'COMPROVATIVO_PENDENTE_RECONCILIACAO',
    'financeiro',
    'pagamento',
    q.pagamento_id::text,
    jsonb_build_object(
      'headline', 'Comprovativo aguarda processamento',
      'subline', q.aluno_nome || ' — ' || COALESCE(q.servico_nome, 'Mensalidade Escolar'),
      'pagamento_id', q.pagamento_id,
      'tipo_entidade', q.tipo_entidade,
      'idade_horas', q.idade_horas,
      'prioridade', q.prioridade,
      'next_action', jsonb_build_object('label', 'Abrir fila de recebimentos', 'href', '/secretaria/recebimentos')
    ),
    'recebimento-pendente:' || q.pagamento_id::text || ':' || to_char(current_date, 'YYYYMMDD')
  FROM public.vw_pagamentos_pendentes q
  WHERE q.comprovante_url IS NOT NULL
    AND q.idade_horas >= GREATEST(COALESCE(p_min_age_hours, 24), 1)
  ON CONFLICT (escola_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliar_pagamentos_pendentes(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconciliar_pagamentos_pendentes(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'reconciliar-pagamentos-pendentes';
    PERFORM cron.schedule(
      'reconciliar-pagamentos-pendentes',
      '*/15 * * * *',
      $cron$SELECT public.reconciliar_pagamentos_pendentes(24);$cron$
    );
  END IF;
EXCEPTION WHEN undefined_table OR undefined_function THEN
  NULL;
END;
$$;
