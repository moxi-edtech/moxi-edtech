BEGIN;

-- =================================================================
-- Tabela para Fecho de Caixa Cego
--
-- OBJETIVO:
-- 1. Armazenar as declarações de valores feitas pelos operadores
--    de forma "cega" (sem que eles vejam os totais do sistema).
-- 2. Registrar os totais do sistema e as diferenças para aprovação
--    de um gerente/admin.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.fecho_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  
  operador_id uuid NOT NULL REFERENCES auth.users(id),
  data_fecho date NOT NULL,
  
  -- Valores declarados pelo operador
  valor_declarado_especie numeric(14, 2) NOT NULL,
  valor_declarado_tpa numeric(14, 2) NOT NULL,
  valor_declarado_transferencia numeric(14, 2) NOT NULL,
  
  -- Valores calculados pelo sistema (preenchidos na aprovação)
  valor_sistema_especie numeric(14, 2),
  valor_sistema_tpa numeric(14, 2),
  valor_sistema_transferencia numeric(14, 2),
  
  -- Diferenças (calculadas na aprovação)
  diferenca_especie numeric(14, 2),
  diferenca_tpa numeric(14, 2),
  diferenca_transferencia numeric(14, 2),
  
  status text NOT NULL DEFAULT 'declarado', -- declarado, aprovado

  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  observacao_aprovador text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garante que um operador só pode fazer uma declaração por dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_fecho_caixa_operador_dia
  ON public.fecho_caixa (escola_id, operador_id, data_fecho);

ALTER TABLE public.fecho_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seus próprios fechos de caixa"
  ON public.fecho_caixa
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

COMMENT ON TABLE public.fecho_caixa IS 'Registra as declarações de fecho de caixa dos operadores e a posterior aprovação.';
COMMENT ON COLUMN public.fecho_caixa.status IS 'Status do fecho: declarado (pelo operador), aprovado (pelo admin).';

COMMIT;
