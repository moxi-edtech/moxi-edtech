BEGIN;

-- A fila pós-virada deve usar a dívida da matrícula de origem, não o ledger
-- agregado do aluno. O ledger é append-only e pode conter competências,
-- serviços e anos diferentes; mensalidades.matricula_id é a dimensão
-- operacional correcta para esta decisão.
CREATE OR REPLACE FUNCTION public.get_pos_virada_pendencias(
  p_escola_id uuid,
  p_origem_session_id uuid,
  p_destino_session_id uuid
)
RETURNS TABLE (
  matricula_id uuid,
  reclassificacao_id uuid,
  aluno_id uuid,
  nome text,
  turma text,
  status_matricula text,
  saldo numeric,
  motivo text,
  tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  RETURN QUERY
  WITH matricula_saldos AS (
    SELECT m.id AS matricula_id,
           COALESCE(SUM(
             CASE
               WHEN me.status IN ('pago', 'isento', 'cancelado') THEN 0
               ELSE GREATEST(
                 COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0),
                 0
               )
             END
           ), 0)::numeric AS saldo
    FROM public.matriculas m
    LEFT JOIN public.mensalidades me
      ON me.escola_id = p_escola_id
     AND me.matricula_id = m.id
    WHERE m.escola_id = p_escola_id
      AND m.session_id IN (p_origem_session_id, p_destino_session_id)
    GROUP BY m.id
  ), source_rows AS (
    SELECT m.id AS matricula_id,
           NULL::uuid AS reclassificacao_id,
           m.aluno_id,
           COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno sem nome') AS nome,
           COALESCE(t.nome, 'Turma anterior') AS turma,
           m.status::text AS status_matricula,
           COALESCE(ms.saldo, 0)::numeric AS saldo,
           CASE WHEN COALESCE(ms.saldo, 0) > 0 THEN 'divida' ELSE 'revisao' END AS motivo,
           NULL::text AS tipo
    FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id AND a.escola_id = p_escola_id
    LEFT JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = p_escola_id
    LEFT JOIN matricula_saldos ms ON ms.matricula_id = m.id
    WHERE m.escola_id = p_escola_id
      AND m.session_id = p_origem_session_id
      AND m.ativo = false
      AND NOT EXISTS (
        SELECT 1 FROM public.matriculas target
        WHERE target.escola_id = p_escola_id
          AND target.aluno_id = m.aluno_id
          AND target.session_id = p_destino_session_id
          AND target.ativo = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.matricula_reclassificacoes mr
        WHERE mr.escola_id = p_escola_id
          AND mr.aluno_id = m.aluno_id
          AND mr.destino_session_id = p_destino_session_id
          AND mr.status = 'aguardando_destino'
      )
  ), finalist_rows AS (
    SELECT mr.matricula_id,
           mr.id AS reclassificacao_id,
           mr.aluno_id,
           COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno sem nome') AS nome,
           COALESCE(origin_turma.nome, target_turma.nome, 'Turma não definida') AS turma,
           m.status::text AS status_matricula,
           COALESCE(ms.saldo, 0)::numeric AS saldo,
           'finalista'::text AS motivo,
           mr.tipo::text AS tipo
    FROM public.matricula_reclassificacoes mr
    JOIN public.alunos a ON a.id = mr.aluno_id AND a.escola_id = p_escola_id
    LEFT JOIN public.matriculas m ON m.id = mr.matricula_id AND m.escola_id = p_escola_id
    LEFT JOIN public.turmas origin_turma ON origin_turma.id = mr.origem_turma_id AND origin_turma.escola_id = p_escola_id
    LEFT JOIN public.turmas target_turma ON target_turma.id = mr.destino_turma_id AND target_turma.escola_id = p_escola_id
    LEFT JOIN matricula_saldos ms ON ms.matricula_id = mr.matricula_id
    WHERE mr.escola_id = p_escola_id
      AND mr.destino_session_id = p_destino_session_id
      AND mr.status = 'aguardando_destino'
  )
  SELECT * FROM source_rows
  UNION ALL
  SELECT * FROM finalist_rows
  ORDER BY nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_pos_virada_pendencias(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_virada_pendencias(uuid, uuid, uuid) TO authenticated;

COMMIT;
