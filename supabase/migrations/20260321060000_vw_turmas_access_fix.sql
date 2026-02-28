CREATE OR REPLACE VIEW public.vw_turmas_para_matricula
WITH (security_invoker = true) AS
SELECT
  id,
  escola_id,
  session_id,
  turma_nome,
  turma_codigo,
  turno,
  capacidade_maxima,
  sala,
  classe_nome,
  curso_nome,
  curso_tipo,
  curso_is_custom,
  curso_global_hash,
  classe_id,
  curso_id,
  ano_letivo,
  ocupacao_atual,
  ultima_matricula,
  status_validacao
FROM internal.mv_turmas_para_matricula m
WHERE public.has_access_to_escola_fast(m.escola_id);
