BEGIN;

CREATE OR REPLACE VIEW public.vw_financeiro_carteira_alunos
WITH (security_invoker = true) AS
SELECT
  carteira.escola_id,
  carteira.matricula_id,
  carteira.aluno_id,
  carteira.numero_matricula,
  carteira.nome_aluno,
  carteira.responsavel,
  carteira.telefone,
  carteira.turma_id,
  carteira.nome_turma,
  carteira.classe_id,
  carteira.nome_classe,
  carteira.curso_id,
  carteira.nome_curso,
  carteira.ano_letivo,
  carteira.qtd_mensalidades,
  carteira.qtd_mensalidades_pagas,
  carteira.qtd_mensalidades_pendentes,
  carteira.qtd_mensalidades_atrasadas,
  carteira.valor_previsto_total,
  carteira.valor_pago_total,
  carteira.valor_em_aberto,
  carteira.valor_em_atraso,
  carteira.proximo_vencimento,
  carteira.vencimento_mais_antigo,
  carteira.dias_maximo_atraso,
  carteira.status_financeiro,
  CASE
    WHEN carteira.valor_em_atraso <= 0 THEN 'sem_risco'
    WHEN carteira.dias_maximo_atraso >= 30 THEN 'critico'
    WHEN carteira.dias_maximo_atraso >= 10 THEN 'atencao'
    ELSE 'recente'
  END::text AS status_risco
FROM public.get_financeiro_carteira_alunos_for_current_user() AS carteira;

ALTER VIEW public.vw_financeiro_carteira_alunos OWNER TO postgres;

REVOKE ALL ON public.vw_financeiro_carteira_alunos
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vw_financeiro_carteira_alunos
  TO authenticated, service_role;

COMMIT;
