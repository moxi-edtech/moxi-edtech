-- Migration: 20261220000001_create_candidaturas_bucket.sql
-- Descrição: Criação do bucket para documentos de candidaturas públicas e internas.

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidaturas', 
  'candidaturas', 
  false, 
  5242880, -- 5MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Acesso

-- Permissão de Upload (Público)
-- Permitimos que qualquer pessoa faça upload, mas a organização será por pasta (escola_id/candidatura_id)
CREATE POLICY "Permitir upload público de documentos de candidatura"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'candidaturas');

-- Permissão de Leitura (Admin/Secretaria)
-- Apenas usuários autenticados da mesma escola podem ler
CREATE POLICY "Permitir leitura de documentos por admins da escola"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidaturas' 
  AND (
    -- Validar se o usuário pertence à escola (baseado na pasta raiz escola_id)
    (storage.foldername(name))[1] IN (
      SELECT escola_id::text 
      FROM public.escola_users 
      WHERE user_id = auth.uid()
    )
    OR
    -- Ou se é service role
    (auth.role() = 'service_role')
  )
);

-- Permissão de Delete (Admin)
CREATE POLICY "Permitir delete de documentos por admins da escola"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidaturas' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT escola_id::text 
      FROM public.escola_users 
      WHERE user_id = auth.uid()
    )
    OR
    (auth.role() = 'service_role')
  )
);
