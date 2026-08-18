-- Permite configurar a taxa de confirmação/rematrícula por classe.
-- NULL mantém o fallback para o valor global do serviço; 0 significa
-- explicitamente que a classe não paga confirmação.
ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS valor_confirmacao numeric(12,2);

COMMENT ON COLUMN public.financeiro_tabelas.valor_confirmacao IS
  'Taxa de confirmação/rematrícula da classe. NULL usa o valor global; 0 isenta a confirmação.';
