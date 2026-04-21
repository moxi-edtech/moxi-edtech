-- Migration: Suporte a Links Mágicos B2B (Solo Creator)
-- Data: 11/04/2026

-- Adicionar suporte a tokens de bypass de pagamento para faturas globais
ALTER TABLE public.formacao_faturas_lote 
ADD COLUMN IF NOT EXISTS b2b_token TEXT UNIQUE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vagas_contratadas INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vagas_utilizadas INTEGER DEFAULT 0;

-- Índice para busca rápida do link mágico
CREATE INDEX IF NOT EXISTS idx_faturas_b2b_token ON public.formacao_faturas_lote(b2b_token) WHERE b2b_token IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.formacao_faturas_lote.b2b_token IS 'Token único para o Link Mágico Corporativo. Permite inscrição sem pagamento direto.';
