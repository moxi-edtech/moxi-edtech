-- Garantir tabela de regras de preços (financeiro_tabelas) usada pelo motor de mensalidades
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financeiro_tabelas') THEN
    CREATE TABLE public.financeiro_tabelas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
      ano_letivo int NOT NULL,
      curso_id uuid REFERENCES public.cursos(id) ON DELETE SET NULL,
      classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
      valor_matricula numeric(12,2) NOT NULL DEFAULT 0,
      valor_mensalidade numeric(12,2) NOT NULL DEFAULT 0,
      dia_vencimento int DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
      multa_atraso_percentual numeric(5,2) DEFAULT 0,
      multa_diaria numeric(10,2) DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE (escola_id, ano_letivo, curso_id, classe_id)
    );
  END IF;
END$$;

-- Colunas críticas (idempotente caso tabela já exista)
ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS valor_mensalidade numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS dia_vencimento int DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31);

-- Índice auxiliar para buscas por escola/ano
CREATE INDEX IF NOT EXISTS idx_financeiro_tabelas_busca
  ON public.financeiro_tabelas (escola_id, ano_letivo);
