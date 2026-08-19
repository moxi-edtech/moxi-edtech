-- RAA Sprint 4 — eventos estruturados de indisciplina grave
-- Pendente de aprovação humana: não aplicar sem APPROVE explícito.

CREATE TABLE IF NOT EXISTS public.raa_indisciplina_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  gravidade text NOT NULL CHECK (gravidade IN ('grave', 'muito_grave')),
  categoria text NOT NULL CHECK (char_length(trim(categoria)) BETWEEN 3 AND 120),
  descricao text NOT NULL CHECK (char_length(trim(descricao)) BETWEEN 10 AND 4000),
  estado text NOT NULL DEFAULT 'registado' CHECK (estado IN ('registado', 'em_analise', 'resolvido', 'cancelado')),
  impacta_resultado boolean NOT NULL DEFAULT true,
  medida_aplicada text,
  registado_por uuid NOT NULL REFERENCES auth.users(id),
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raa_indisciplina_eventos_contexto_unico UNIQUE (id, escola_id)
);

CREATE INDEX IF NOT EXISTS ix_raa_indisciplina_contexto
  ON public.raa_indisciplina_eventos (escola_id, ano_letivo_id, turma_id, matricula_id, estado);

ALTER TABLE public.raa_indisciplina_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raa_indisciplina_eventos_school_access ON public.raa_indisciplina_eventos;
CREATE POLICY raa_indisciplina_eventos_school_access
  ON public.raa_indisciplina_eventos
  FOR ALL
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

COMMENT ON TABLE public.raa_indisciplina_eventos IS
  'Evento disciplinar grave contextualizado no ano letivo e na matrícula; fonte auditável para o resolvedor RAA.';
