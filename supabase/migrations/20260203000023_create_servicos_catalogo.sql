BEGIN;

-- =================================================================
-- Tabela para Catálogo de Serviços
--
-- OBJETIVO:
-- Armazenar os serviços que a escola oferece para venda/emissão,
-- como declarações, 2ª via de cartão, etc., e seus preços.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.servicos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  
  nome text NOT NULL,
  descricao text,
  preco numeric(14, 2) NOT NULL DEFAULT 0,
  tipo text NOT NULL, -- Ex: 'documento', '2a_via', 'outro'
  
  ativo boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Garante que um serviço com o mesmo nome seja único por escola
  CONSTRAINT uq_servicos_catalogo_escola_nome UNIQUE (escola_id, nome)
);

ALTER TABLE public.servicos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a servicos_catalogo por membros da escola"
  ON public.servicos_catalogo
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id())
  WITH CHECK (escola_id = public.current_tenant_escola_id());

COMMENT ON TABLE public.servicos_catalogo IS 'Catálogo de serviços oferecidos pela escola, com preços.';
COMMENT ON COLUMN public.servicos_catalogo.tipo IS 'Tipo de serviço (ex: documento, 2a_via, outro).';

COMMIT;
