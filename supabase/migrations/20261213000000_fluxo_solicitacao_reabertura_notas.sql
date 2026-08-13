ALTER TABLE public.excecoes_pauta
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'APROVADO',
  ADD COLUMN IF NOT EXISTS solicitado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ano_letivo_id uuid REFERENCES public.anos_letivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decisao_motivo text;

ALTER TABLE public.excecoes_pauta DROP CONSTRAINT IF EXISTS excecoes_pauta_status_check;
ALTER TABLE public.excecoes_pauta ADD CONSTRAINT excecoes_pauta_status_check CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO', 'EXPIRADO'));

CREATE INDEX IF NOT EXISTS idx_excecoes_pauta_review ON public.excecoes_pauta (escola_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_bypass_pauta_lock(p_escola_id uuid, p_turma_id uuid, p_avaliacao_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trimestre smallint; v_disciplina_id uuid;
BEGIN
  SELECT a.trimestre, td.disciplina_id INTO v_trimestre, v_disciplina_id
  FROM public.avaliacoes a JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id WHERE a.id = p_avaliacao_id;
  RETURN EXISTS (SELECT 1 FROM public.excecoes_pauta WHERE escola_id = p_escola_id AND turma_id = p_turma_id AND user_id = p_user_id AND status = 'APROVADO' AND expira_em > now() AND (trimestre IS NULL OR trimestre = v_trimestre) AND (disciplina_id IS NULL OR disciplina_id = v_disciplina_id));
END; $$;
