BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('image', 'video', 'script', 'document')),
    titulo TEXT NOT NULL,
    descricao TEXT,
    url TEXT, -- URL para ficheiros ou links externos
    conteudo TEXT, -- Para scripts/textos
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

-- Super Admin pode fazer tudo
DO $guard_policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketing_assets' AND policyname='Super Admin manage assets') THEN
CREATE POLICY "Super Admin manage assets" ON public.marketing_assets
    FOR ALL USING (public.is_super_admin());
  END IF;
END $guard_policy$;

-- Afiliados e Anonimos podem LER (para o portal de afiliados)
DO $guard_policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketing_assets' AND policyname='Public read active assets') THEN
CREATE POLICY "Public read active assets" ON public.marketing_assets
    FOR SELECT USING (is_active = true);
  END IF;
END $guard_policy$;

-- Inserir alguns dados iniciais baseados no que tínhamos
INSERT INTO public.marketing_assets (tipo, titulo, descricao, conteudo)
VALUES ('script', 'Script de Abordagem Direta', 'Ideal para WhatsApp', 'Olá Diretor! Sabia que muitas escolas em Luanda já reduziram as filas de matrícula em 80% usando o KLASSE? Posso enviar-lhe um diagnóstico gratuito de 2 minutos para ver como está a sua escola?');

COMMIT;
