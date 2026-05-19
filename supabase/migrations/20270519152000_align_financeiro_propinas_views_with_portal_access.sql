BEGIN;

CREATE OR REPLACE VIEW public.vw_financeiro_propinas_mensal_escola AS
SELECT
  escola_id,
  ano_letivo,
  ano,
  mes,
  competencia_mes,
  qtd_mensalidades,
  qtd_em_atraso,
  qtd_pagas_adiantadas,
  qtd_parciais,
  total_previsto,
  total_pago,
  total_pago_adiantado,
  total_parcial_em_aberto,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_mensal_escola
WHERE public.has_access_to_escola(escola_id);

ALTER VIEW public.vw_financeiro_propinas_mensal_escola SET (security_invoker = true);

CREATE OR REPLACE VIEW public.vw_financeiro_propinas_por_turma AS
SELECT
  escola_id,
  ano_letivo,
  turma_id,
  turma_nome,
  classe_label,
  turno,
  qtd_mensalidades,
  qtd_em_atraso,
  qtd_pagas_adiantadas,
  qtd_parciais,
  total_previsto,
  total_pago,
  total_pago_adiantado,
  total_parcial_em_aberto,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_por_turma
WHERE public.has_access_to_escola(escola_id);

ALTER VIEW public.vw_financeiro_propinas_por_turma SET (security_invoker = true);

COMMIT;
