BEGIN;

-- =================================================================
-- Tabela para Controle de Uploads de Conciliação
--
-- OBJETIVO:
-- 1. Rastrear cada arquivo de extrato enviado para auditoria.
-- 2. Armazenar a localização do arquivo original para reprocessamento.
-- 3. Permitir um fluxo de processamento assíncrono.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.conciliacao_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size_kb integer,
  
  banco text,
  conta text,
  
  status text NOT NULL DEFAULT 'pending_parsing', -- pending_parsing, parsed, error
  error_details text,

  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.conciliacao_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem gerenciar seus próprios uploads"
  ON public.conciliacao_uploads
  FOR ALL
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id())
  WITH CHECK (escola_id = public.current_tenant_escola_id());

COMMENT ON TABLE public.conciliacao_uploads IS 'Rastreia os arquivos de extrato bancário enviados para conciliação.';
COMMENT ON COLUMN public.conciliacao_uploads.status IS 'Status do processamento do arquivo: pending_parsing, parsed, error.';

COMMIT;
