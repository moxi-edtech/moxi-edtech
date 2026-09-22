BEGIN;

CREATE TABLE IF NOT EXISTS public.ebook_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  escola TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'ebook_matriculas_2026_2027',
  utm_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ebook_leads ENABLE ROW LEVEL SECURITY;

COMMIT;
