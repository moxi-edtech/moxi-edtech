-- Migration: Add course automation and profitability fields
-- Date: 01/05/2026

BEGIN;

-- 1. Add certificate template binding to formacao_cursos
ALTER TABLE public.formacao_cursos 
ADD COLUMN IF NOT EXISTS certificado_template_id uuid REFERENCES public.formacao_certificado_templates(id);

-- 2. Add estimated hourly cost to formacao_curso_comercial
ALTER TABLE public.formacao_curso_comercial 
ADD COLUMN IF NOT EXISTS custo_hora_estimado numeric DEFAULT 0;

-- 3. Create table for support materials
CREATE TABLE IF NOT EXISTS public.formacao_curso_materiais (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    escola_id uuid NOT NULL REFERENCES public.escolas(id),
    curso_id uuid NOT NULL REFERENCES public.formacao_cursos(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    url text NOT NULL,
    tipo text NOT NULL DEFAULT 'pdf', -- 'pdf', 'video', 'link', 'zip'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS for the new table
ALTER TABLE public.formacao_curso_materiais ENABLE ROW LEVEL SECURITY;

-- 5. Policies for formacao_curso_materiais
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Materials are viewable by school members'
    ) THEN
        CREATE POLICY "Materials are viewable by school members" ON public.formacao_curso_materiais
        FOR SELECT USING (is_escola_member(escola_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage materials'
    ) THEN
        CREATE POLICY "Admins can manage materials" ON public.formacao_curso_materiais
        FOR ALL USING (is_escola_diretor(escola_id));
    END IF;
END $$;

COMMIT;
