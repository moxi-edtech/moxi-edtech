-- Migration: Evolve KLASSE Formacao to Course-Centric Model
-- Date: 02/05/2026

BEGIN;

-- 1. Update formacao_cursos
ALTER TABLE public.formacao_cursos ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.formacao_cursos ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.formacao_cursos ADD COLUMN IF NOT EXISTS seo_config jsonb DEFAULT '{}'::jsonb;

-- Function to generate slug
CREATE OR REPLACE FUNCTION public.slugify(v_text text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(btrim(v_text), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate slugs for existing courses
UPDATE public.formacao_cursos 
   SET slug = public.slugify(nome) || '-' || substr(id::text, 1, 4)
 WHERE slug IS NULL;

-- 2. Update formacao_cohorts
ALTER TABLE public.formacao_cohorts ADD COLUMN IF NOT EXISTS visivel_na_landing boolean DEFAULT true;

-- 3. Create formacao_leads for waitlist
CREATE TABLE IF NOT EXISTS public.formacao_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    curso_id uuid REFERENCES public.formacao_cursos(id) ON DELETE CASCADE,
    nome text NOT NULL,
    email text NOT NULL,
    telefone text,
    origem text DEFAULT 'landing_page',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS for formacao_leads
ALTER TABLE public.formacao_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formacao_leads_insert_anon" ON public.formacao_leads
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "formacao_leads_select_backoffice" ON public.formacao_leads
    FOR SELECT TO authenticated
    USING (can_access_formacao_backoffice(escola_id));

COMMIT;
