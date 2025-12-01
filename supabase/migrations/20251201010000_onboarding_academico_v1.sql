-- 20251201_onboarding_academico_v1.sql
-- Módulo acadêmico - estrutura base de disciplinas (SEM RLS aqui)

-- 1) TABELA DISCIPLINAS (idempotente)
CREATE TABLE IF NOT EXISTS public.disciplinas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id  uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  tipo       text DEFAULT 'core',
  curso_id   uuid NULL REFERENCES public.cursos(id) ON DELETE SET NULL,
  classe_id  uuid NULL REFERENCES public.classes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) ÍNDICES ÚTEIS
CREATE INDEX IF NOT EXISTS disciplinas_escola_id_idx
  ON public.disciplinas (escola_id);

CREATE INDEX IF NOT EXISTS disciplinas_nome_idx
  ON public.disciplinas (LOWER(nome));

