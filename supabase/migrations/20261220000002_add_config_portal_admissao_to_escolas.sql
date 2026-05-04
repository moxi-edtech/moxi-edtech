-- Migration: 20261220000002_add_config_portal_admissao_to_escolas.sql
-- Descrição: Adição de coluna de configuração para o portal de admissão pública.

ALTER TABLE public.escolas 
ADD COLUMN IF NOT EXISTS config_portal_admissao JSONB DEFAULT '{
  "campos_extras": [],
  "whatsapp_suporte": null,
  "exibir_vagas": false,
  "termos_condicoes_url": null
}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.escolas.config_portal_admissao IS 'Configurações personalizadas para o portal de admissão pública (K12).';
