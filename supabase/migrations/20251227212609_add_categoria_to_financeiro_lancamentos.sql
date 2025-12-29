ALTER TABLE public.financeiro_lancamentos
ADD COLUMN IF NOT EXISTS categoria financeiro_categoria_item DEFAULT 'outros' NOT NULL;
