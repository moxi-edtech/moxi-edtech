-- Migration: 20260227170000_create_archive_bucket_retention.sql
-- Descrição: Criação do bucket de arquivo morto (7 anos) para conformidade legal.

-- 1. Criar o bucket de arquivo se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archive-retention', 
  'archive-retention', 
  false, 
  10485760, -- 10MB limit por arquivo
  ARRAY['application/pdf', 'application/zip', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de RLS para o archive (Super Admin apenas para deleção)
-- Leitura restrita a quem tem permissão na escola

CREATE POLICY "Archive read access by school"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'archive-retention' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'escola_id')
);

CREATE POLICY "Archive upload only by service role"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'archive-retention');

-- Apenas super-admin pode deletar do arquivo morto (para evitar fraude)
CREATE POLICY "Archive delete only by super-admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-retention'
  AND (auth.jwt() ->> 'role') = 'super-admin'
);
