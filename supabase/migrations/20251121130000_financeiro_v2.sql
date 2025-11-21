-- ======================================================================
--  MÓDULO FINANCEIRO — V2 (Bulletproof)
--  - Hierarquia: Classe > Curso > Escola
--  - Sem cobranças duplicadas
--  - Sem datas inválidas
--  - Set-based, performático
-- ======================================================================

-- ======================================================================
-- 1. TABELA: tabelas_mensalidade
-- Regras de mensalidade por classe/curso/escola
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.tabelas_mensalidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    escola_id UUID NOT NULL
        REFERENCES public.escolas(id) ON DELETE CASCADE,

    -- Regras opcionais
    classe_id UUID
        REFERENCES public.classes(id) ON DELETE SET NULL,

    curso_oferta_id UUID
        REFERENCES public.cursos_oferta(id) ON DELETE SET NULL,

    -- Valor da mensalidade
    valor_padrao NUMERIC(12,2) NOT NULL CHECK (valor_padrao >= 0),

    -- Dia do vencimento "ideal" (1–31), usado como base
    dia_vencimento SMALLINT NOT NULL
        CHECK (dia_vencimento BETWEEN 1 AND 31),

    -- Prioridade interna, caso você precise ordenar regras de mesmo tipo
    prioridade SMALLINT NOT NULL DEFAULT 1,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tabelas_mensalidade_escola
    ON public.tabelas_mensalidade(escola_id);

CREATE INDEX IF NOT EXISTS idx_tabelas_mensalidade_classe
    ON public.tabelas_mensalidade(classe_id);

CREATE INDEX IF NOT EXISTS idx_tabelas_mensalidade_curso
    ON public.tabelas_mensalidade(curso_oferta_id);

CREATE INDEX IF NOT EXISTS idx_tabelas_mensalidade_prioridade
    ON public.tabelas_mensalidade(prioridade);


-- ======================================================================
-- 2. FUNÇÃO: resolver_mensalidade_por_aluno (otimizada)
--   - 1 SELECT só, com joins e ordenação por especificidade
--   - Retorna a melhor regra (classe > curso > escola)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.resolver_mensalidade_por_aluno(p_aluno_id UUID)
RETURNS TABLE (
    valor NUMERIC(12,2),
    dia_vencimento SMALLINT,
    origem TEXT,
    regra_id UUID,
    escola_id UUID
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH ctx AS (
        SELECT
            m.id              AS matricula_id,
            m.aluno_id,
            m.escola_id,
            t.classe_id,
            mc.curso_oferta_id
        FROM public.matriculas m
        LEFT JOIN public.turmas t
            ON t.id = m.turma_id
        LEFT JOIN public.matriculas_cursos mc
            ON mc.matricula_id = m.id
        WHERE m.aluno_id = p_aluno_id
          AND m.status = 'ativo'
        ORDER BY m.created_at DESC
        LIMIT 1
    )
    SELECT
        tm.valor_padrao           AS valor,
        tm.dia_vencimento         AS dia_vencimento,
        CASE
            WHEN tm.classe_id IS NOT NULL THEN 'classe'
            WHEN tm.curso_oferta_id IS NOT NULL THEN 'curso'
            ELSE 'escola'
        END                       AS origem,
        tm.id                     AS regra_id,
        ctx.escola_id             AS escola_id
    FROM ctx
    JOIN public.tabelas_mensalidade tm
      ON tm.escola_id = ctx.escola_id
     AND tm.ativo = TRUE
     AND (
            (tm.classe_id IS NOT NULL AND tm.classe_id = ctx.classe_id)
         OR (tm.curso_oferta_id IS NOT NULL AND tm.curso_oferta_id = ctx.curso_oferta_id)
         OR (tm.classe_id IS NULL AND tm.curso_oferta_id IS NULL)
     )
    ORDER BY
        -- hierarquia: classe > curso > escola
        CASE
            WHEN tm.classe_id IS NOT NULL THEN 1
            WHEN tm.curso_oferta_id IS NOT NULL THEN 2
            ELSE 3
        END,
        tm.prioridade ASC
    LIMIT 1;
$$;


-- ======================================================================
-- 3. TABELA: cobrancas
--   - Fatura mensal gerada para o aluno
--   - Unicidade por escola+aluno+mês+ano
--   - data_vencimento DATE (juridicamente correta)
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.cobrancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    escola_id UUID NOT NULL
        REFERENCES public.escolas(id) ON DELETE CASCADE,

    aluno_id UUID NOT NULL
        REFERENCES public.alunos(id) ON DELETE CASCADE,

    matricula_id UUID NOT NULL
        REFERENCES public.matriculas(id) ON DELETE CASCADE,

    valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),

    -- Data de vencimento REAL (2025-02-28 por exemplo)
    data_vencimento DATE NOT NULL,

    -- Para relatórios e agrupamentos
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL CHECK (ano >= 2020),

    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'pago', 'atrasado')),

    origem_regra TEXT,
    regra_id UUID REFERENCES public.tabelas_mensalidade(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 🔒 Regra de ouro: 1 fatura por aluno por mês por escola
    CONSTRAINT uniq_cobranca_mensal
        UNIQUE (escola_id, aluno_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_escola
    ON public.cobrancas(escola_id);

CREATE INDEX IF NOT EXISTS idx_cobrancas_aluno
    ON public.cobrancas(aluno_id);

CREATE INDEX IF NOT EXISTS idx_cobrancas_matricula
    ON public.cobrancas(matricula_id);

CREATE INDEX IF NOT EXISTS idx_cobrancas_mes_ano
    ON public.cobrancas(mes, ano);


-- ======================================================================
-- 4. FUNÇÃO: gerar_faturas_mensais(p_ano, p_mes)
--   - Set-based, sem loop por aluno
--   - Usa resolver_mensalidade_por_aluno em modo "vetorizado"
--   - Ignora quem já tem fatura (NOT EXISTS + UNIQUE)
--   - Ajusta data de vencimento para último dia do mês
--     se dia_vencimento > último_dia
-- ======================================================================

CREATE OR REPLACE FUNCTION public.gerar_faturas_mensais(p_ano INT, p_mes INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_primeiro_dia DATE;
    v_ultimo_dia   DATE;
BEGIN
    -- Base pra cálculo do último dia do mês
    v_primeiro_dia := make_date(p_ano, p_mes, 1);
    v_ultimo_dia := (date_trunc('month', v_primeiro_dia) + interval '1 month - 1 day')::date;

    INSERT INTO public.cobrancas (
        escola_id,
        aluno_id,
        matricula_id,
        valor,
        data_vencimento,
        mes,
        ano,
        origem_regra,
        regra_id
    )
    SELECT
        ctx.escola_id,
        ctx.aluno_id,
        ctx.matricula_id,
        r.valor,
        -- Ajuste seguro da data de vencimento:
        -- se dia_vencimento = 30 e mês tem 28, vira 28
        make_date(
            p_ano,
            p_mes,
            LEAST(r.dia_vencimento, EXTRACT(DAY FROM v_ultimo_dia)::INT)
        )::date AS data_vencimento,
        p_mes,
        p_ano,
        r.origem_regra,
        r.regra_id
    FROM (
        -- Contexto por matrícula ativa
        SELECT DISTINCT ON (m.id)
            m.id          AS matricula_id,
            m.aluno_id,
            m.escola_id
        FROM public.matriculas m
        WHERE m.status = 'ativo'
        ORDER BY m.id
    ) AS ctx
    JOIN LATERAL public.resolver_mensalidade_por_aluno(ctx.aluno_id) AS r
        ON r.escola_id = ctx.escola_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.cobrancas c
        WHERE c.escola_id = ctx.escola_id
          AND c.aluno_id = ctx.aluno_id
          AND c.mes = p_mes
          AND c.ano = p_ano
    );
END;
$$;


-- ======================================================================
-- 5. RLS — Multi-tenant + papéis
--   - Admin/Diretor: tudo da escola
--   - Secretaria: ver cobranças da escola
--   - Aluno: ver somente suas cobranças
-- ======================================================================

ALTER TABLE public.tabelas_mensalidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas          ENABLE ROW LEVEL SECURITY;

-- Regras de mensalidade: somente admin/diretor financeiro

CREATE POLICY mensalidade_admin_full ON public.tabelas_mensalidade
    FOR ALL
    USING (
        check_super_admin_role()
        OR is_escola_admin(escola_id)
    )
    WITH CHECK (
        check_super_admin_role()
        OR is_escola_admin(escola_id)
    );

-- Cobrancas: aluno vê só as suas

CREATE POLICY cobrancas_aluno_select ON public.cobrancas
    FOR SELECT
    USING (auth.uid() = aluno_id);

-- Secretaria / staff podem ver tudo da escola

CREATE POLICY cobrancas_staff_select ON public.cobrancas
    FOR SELECT
    USING (is_escola_member(escola_id));

-- Admin pode criar/editar/apagar (baixa manual, ajustes)

CREATE POLICY cobrancas_admin_write ON public.cobrancas
    FOR ALL
    USING (is_escola_admin(escola_id))
    WITH CHECK (is_escola_admin(escola_id));

-- ======================================================================
-- FIM — Módulo Financeiro V2
-- ======================================================================
