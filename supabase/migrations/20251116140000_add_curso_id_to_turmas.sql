-- Add curso_id to turmas table
-- This is a temporary fix to support a legacy frontend that still sends curso_id.
-- The long-term solution is to update the frontend to send classe_id instead.

ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_turmas_curso_id ON public.turmas(curso_id);
