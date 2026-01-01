-- Add missing fields and staff_id columns to turmas table
ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS turno TEXT,
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.school_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sala TEXT,
ADD COLUMN IF NOT EXISTS coordenador_pedagogico_id UUID REFERENCES public.escola_usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS diretor_turma_id UUID REFERENCES public.escola_usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_turmas_session_id ON public.turmas(session_id);
CREATE INDEX IF NOT EXISTS idx_turmas_coordenador_pedagogico_id ON public.turmas(coordenador_pedagogico_id);
CREATE INDEX IF NOT EXISTS idx_turmas_diretor_turma_id ON public.turmas(diretor_turma_id);
