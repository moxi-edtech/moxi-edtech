BEGIN;

-- O destino só pode ficar activo depois da quitação do saldo vencido da
-- matrícula de origem. Corrige exclusivamente o resíduo do piloto Curtume
-- que foi activado antes desse gate existir.
WITH curtume AS (
  SELECT id
  FROM public.escolas
  WHERE slug = 'complexo-escolar-privado-advetista-de-curtume'
), destinos_em_divida AS (
  SELECT DISTINCT destino.id
  FROM public.matriculas destino
  JOIN curtume c ON c.id = destino.escola_id
  JOIN public.matriculas origem
    ON origem.escola_id = destino.escola_id
   AND origem.aluno_id = destino.aluno_id
   AND origem.ano_letivo = 2025
  JOIN public.mensalidades mensalidade
    ON mensalidade.escola_id = origem.escola_id
   AND mensalidade.matricula_id = origem.id
  WHERE destino.ano_letivo = 2026
    AND destino.ativo IS TRUE
    AND lower(coalesce(destino.status, '')) IN ('ativo', 'ativa', 'active')
    AND lower(coalesce(mensalidade.status, '')) NOT IN ('pago', 'isento', 'cancelado')
    AND mensalidade.data_vencimento < current_date
    AND greatest(
      coalesce(mensalidade.valor_previsto, mensalidade.valor, 0)
        - coalesce(mensalidade.valor_pago_total, 0),
      0
    ) > 0
)
UPDATE public.matriculas destino
SET status = 'pendente',
    ativo = false,
    motivo_fecho = 'Ativação 2026 suspensa: dívida vencida na matrícula de origem',
    data_fecho = NULL,
    updated_at = now()
WHERE destino.id IN (SELECT id FROM destinos_em_divida);

COMMIT;
