-- supabase/migrations/20260411000000_create_rpc_get_propinas_por_turma.sql
BEGIN;

-- Otimização: Criar um índice para acelerar a consulta da função.
-- Este índice cobre os filtros mais comuns (escola, ano, categoria).
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_escola_ano_categoria
  ON public.financeiro_lancamentos (escola_id, ano_referencia, categoria);

-- Função para obter o resumo de propinas por turma
CREATE OR REPLACE FUNCTION public.get_propinas_por_turma(p_ano_letivo integer)
RETURNS TABLE (
    escola_id uuid,
    ano_letivo integer,
    turma_id uuid,
    turma_nome text,
    classe_label text,
    turno text,
    qtd_mensalidades bigint,
    qtd_em_atraso bigint,
    total_previsto numeric,
    total_pago numeric,
    total_em_atraso numeric,
    inadimplencia_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.escola_id,
        l.ano_referencia AS ano_letivo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        c.nome AS classe_label,
        t.turno,
        count(l.id) AS qtd_mensalidades,
        count(l.id) FILTER (WHERE l.status IN ('atrasado', 'vencido')) AS qtd_em_atraso,
        COALESCE(sum(l.valor), 0) AS total_previsto,
        COALESCE(sum(l.valor_pago), 0) AS total_pago,
        COALESCE(sum(l.valor - l.valor_pago), 0) AS total_em_atraso,
        CASE
            WHEN count(l.id) > 0 THEN
                ROUND(
                    (count(l.id) FILTER (WHERE l.status IN ('atrasado', 'vencido')) * 100.0 / count(l.id))
                , 2)
            ELSE 0
        END AS inadimplencia_pct
    FROM
        public.financeiro_lancamentos l
    LEFT JOIN
        public.matriculas m ON l.matricula_id = m.id
    LEFT JOIN
        public.turmas t ON m.turma_id = t.id
    LEFT JOIN
        public.classes c ON t.classe_id = c.id
    WHERE
        l.escola_id = public.current_tenant_escola_id()
        AND l.ano_referencia = p_ano_letivo
        AND l.categoria = 'mensalidade'
        AND t.id IS NOT NULL
    GROUP BY
        l.escola_id,
        l.ano_referencia,
        t.id,
        c.id;
END;
$$;

COMMIT;
